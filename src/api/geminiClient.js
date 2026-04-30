// ============================================================
// Gemini API Client — all production traffic via gemini-proxy Edge
// ============================================================
// Optional dev-only direct calls: EXPO_PUBLIC_GEMINI_USE_DIRECT + __DEV__

import Constants from 'expo-constants';
import {
  supabase,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from './supabaseClient';

export const GEMINI_MODEL = 'gemini-2.5-flash';
const THINKING_BUDGET = 0;

const EDGE_FUNCTION_NAME = 'gemini-proxy';
/** Client timeout must exceed Edge upstream timeout (~25s). */
export const REQUEST_TIMEOUT_MS = 35000;

/** Rough limit on serialized Gemini contents (chars) before Edge rejects huge payloads. */
const MAX_GEMINI_CONTENTS_CHARS = 700_000;

const GENERIC_UNAVAILABLE_USER_HE =
  'השירות חווה עומס כרגע. נסה שוב בעוד כמה דקות.';

export class RateLimitError extends Error {
  constructor(message, { used, limit } = {}) {
    super(message || 'הגעת למכסה היומית');
    this.name = 'RateLimitError';
    this.code = 'DAILY_LIMIT_EXCEEDED';
    this.used = used;
    this.limit = limit;
  }
}

/** Structured failure from Edge ({ ok: false, errorKind, retryable, ... }). */
export class GeminiInvocationError extends Error {
  constructor(message, { errorKind, retryable, requestId, status } = {}) {
    super(message || GENERIC_UNAVAILABLE_USER_HE);
    this.name = 'GeminiInvocationError';
    this.code = 'GEMINI_EDGE';
    this.errorKind = errorKind ?? 'unknown';
    this.retryable = Boolean(retryable);
    this.requestId = requestId ?? '';
    this.status = status;
    /** Always generic Hebrew for UI bubbles */
    this.userMessage = GENERIC_UNAVAILABLE_USER_HE;
  }
}

function randomUUID() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const getClientDailyLimitParam = () => {
  const n = Number(process.env.EXPO_PUBLIC_DAILY_MESSAGE_LIMIT ?? '60');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 60;
};

const getDirectApiKey = () => {
  const fromEnv = String(process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '').trim();
  if (fromEnv) return fromEnv;
  return String(Constants.expoConfig?.extra?.geminiApiKeyForDirect ?? '').trim();
};

const useDirectOnlyDev = () => {
  if (!__DEV__) return false;
  const v = process.env.EXPO_PUBLIC_GEMINI_USE_DIRECT;
  return v === '1' || String(v).toLowerCase() === 'true';
};

async function consumeRateLimitSlotOrThrow() {
  const { data, error } = await supabase.rpc('increment_api_usage', {
    p_limit: getClientDailyLimitParam(),
  });
  if (error) {
    throw new Error(error.message || 'rate_limit_check_failed');
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) {
    const lim = row?.daily_limit ?? getClientDailyLimitParam();
    throw new RateLimitError(
      `הגעת למכסה היומית של ${lim} הודעות. נסה שוב מחר 🌙`,
      { used: row?.new_count, limit: lim },
    );
  }
}

async function fetchGeminiDirect(body, options = {}, apiKey) {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const externalSignal = options.signal;
  const model = body.model || GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => {
    if (!timedOut) controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      const e = new Error('Cancelled');
      e.name = 'AbortError';
      e.code = 'USER_CANCEL';
      throw e;
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: body.contents,
        generationConfig: body.generationConfig,
        safetySettings: body.safetySettings,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const apiMsg =
        data?.error?.message ||
        (typeof data?.error === 'string' ? data.error : null) ||
        `Gemini HTTP ${res.status}`;
      const e = new Error(apiMsg);
      e.status = res.status;
      throw e;
    }
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
    if (err?.name === 'AbortError') {
      if (timedOut) {
        const to = new Error('Request timed out');
        to.code = 'TIMEOUT';
        throw to;
      }
      const cancel = new Error('Cancelled');
      cancel.name = 'AbortError';
      cancel.code = 'USER_CANCEL';
      throw cancel;
    }
    throw err;
  }
}

function parseGeminiResponse(data) {
  if (data?.error) {
    if (__DEV__) console.error('❌ Gemini API error:', JSON.stringify(data.error));
    throw new GeminiInvocationError(GENERIC_UNAVAILABLE_USER_HE, {
      errorKind: 'gemini_body_error',
      retryable: false,
    });
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    if (__DEV__) {
      console.error('⚠️ No text in Gemini response:', JSON.stringify(data)?.substring(0, 300));
    }
    throw new GeminiInvocationError(GENERIC_UNAVAILABLE_USER_HE, {
      errorKind: 'empty_response',
      retryable: true,
    });
  }

  if (__DEV__) {
    console.log(`✅ Gemini response:`, text.substring(0, 80));
  }
  return text;
}

function truncateGeminiContents(contents, maxChars = MAX_GEMINI_CONTENTS_CHARS) {
  if (!Array.isArray(contents) || contents.length === 0) return contents;
  let slice = [...contents];
  while (slice.length > 0) {
    const s = JSON.stringify(slice);
    if (s.length <= maxChars) return slice;
    slice = slice.slice(1);
  }
  return [{ role: 'user', parts: [{ text: '…' }] }];
}

function mapParsedEdgeFailure(parsed, status) {
  if (
    parsed?.code === 'DAILY_LIMIT_EXCEEDED' ||
    parsed?.errorKind === 'quota' ||
    parsed?.error === 'rate_limited'
  ) {
    return new RateLimitError(
      parsed?.message ||
        'הגעת למכסה היומית של ההודעות. נסה שוב מחר 🌙',
      { used: parsed?.used, limit: parsed?.limit },
    );
  }
  return new GeminiInvocationError(GENERIC_UNAVAILABLE_USER_HE, {
    errorKind: parsed?.errorKind || 'unknown',
    retryable: parsed?.retryable !== false,
    requestId: parsed?.requestId || '',
    status,
  });
}

/**
 * Invoke Edge function with optional single transport retry for transient failures.
 * Uses explicit fetch (same headers as REST) because RN often breaks on functions.invoke.
 */
const invokeProxy = async (body, options = {}) => {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const externalSignal = options.signal;
  const transportRetries = options.transportRetries ?? 1;

  const runOnce = async () => {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    const onExternalAbort = () => {
      if (!timedOut) controller.abort();
    };

    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutId);
        const e = new Error('Cancelled');
        e.name = 'AbortError';
        e.code = 'USER_CANCEL';
        throw e;
      }
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    const version = String(Constants.expoConfig?.version ?? '');
    const iosBuild = Constants.expoConfig?.ios?.buildNumber;
    const androidBuild = Constants.expoConfig?.android?.versionCode;
    const build =
      iosBuild != null
        ? String(iosBuild)
        : androidBuild != null
          ? String(androidBuild)
          : '';

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        clearTimeout(timeoutId);
        externalSignal?.removeEventListener('abort', onExternalAbort);
        throw new GeminiInvocationError(GENERIC_UNAVAILABLE_USER_HE, {
          errorKind: 'unauthorized',
          retryable: false,
          requestId: String(body.requestId ?? ''),
        });
      }

      const baseUrl = String(SUPABASE_URL || '').replace(/\/$/, '');
      const url = `${baseUrl}/functions/v1/${EDGE_FUNCTION_NAME}`;

      let res;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
            'x-app-version': version,
            'x-app-build': build,
            'x-request-id': String(body.requestId ?? ''),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (netErr) {
        clearTimeout(timeoutId);
        externalSignal?.removeEventListener('abort', onExternalAbort);
        if (netErr?.name === 'AbortError') {
          if (timedOut) {
            const to = new GeminiInvocationError(GENERIC_UNAVAILABLE_USER_HE, {
              errorKind: 'timeout',
              retryable: true,
            });
            to.code = 'TIMEOUT';
            throw to;
          }
          const cancel = new Error('Cancelled');
          cancel.name = 'AbortError';
          cancel.code = 'USER_CANCEL';
          throw cancel;
        }
        const wrapped = new GeminiInvocationError(GENERIC_UNAVAILABLE_USER_HE, {
          errorKind: 'transport',
          retryable: true,
          requestId: String(body.requestId ?? ''),
        });
        wrapped.cause = netErr;
        throw wrapped;
      }

      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', onExternalAbort);

      const rawText = await res.text();
      let payload = null;
      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch {
        payload = null;
      }

      if (payload && typeof payload === 'object' && payload.ok === false) {
        throw mapParsedEdgeFailure(payload, res.status);
      }

      if (
        payload?.code === 'DAILY_LIMIT_EXCEEDED' ||
        payload?.error === 'rate_limited'
      ) {
        throw new RateLimitError(
          payload?.message || 'הגעת למכסה היומית של ההודעות. נסה שוב מחר 🌙',
          { used: payload?.used, limit: payload?.limit },
        );
      }

      if (!res.ok) {
        throw new GeminiInvocationError(GENERIC_UNAVAILABLE_USER_HE, {
          errorKind: 'transport',
          retryable: res.status >= 500 || res.status === 429,
          requestId: String(body.requestId ?? ''),
          status: res.status,
        });
      }

      if (payload?.ok === true && payload?.gemini != null) {
        return payload;
      }

      throw new GeminiInvocationError(GENERIC_UNAVAILABLE_USER_HE, {
        errorKind: 'bad_envelope',
        retryable: false,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', onExternalAbort);
      if (err instanceof RateLimitError) throw err;
      if (err instanceof GeminiInvocationError) throw err;
      if (err?.name === 'AbortError') {
        if (timedOut) {
          const to = new GeminiInvocationError(GENERIC_UNAVAILABLE_USER_HE, {
            errorKind: 'timeout',
            retryable: true,
          });
          to.code = 'TIMEOUT';
          throw to;
        }
        const cancel = new Error('Cancelled');
        cancel.name = 'AbortError';
        cancel.code = 'USER_CANCEL';
        throw cancel;
      }
      throw err;
    }
  };

  try {
    return await runOnce();
  } catch (first) {
    const retryable =
      first instanceof GeminiInvocationError &&
      first.retryable &&
      first.errorKind !== 'missing_ids';
    const msg = String(first?.message || '');
    const transportFail =
      first instanceof GeminiInvocationError &&
      (first.errorKind === 'transport' ||
        /Failed to send|Network|fetch/i.test(msg));

    if (
      transportRetries > 0 &&
      (retryable || transportFail) &&
      first?.code !== 'USER_CANCEL' &&
      first?.code !== 'TIMEOUT'
    ) {
      await new Promise((r) =>
        setTimeout(r, 320 + Math.floor(Math.random() * 280)),
      );
      return await invokeProxy(body, { ...options, transportRetries: 0 });
    }
    throw first;
  }
};

export const callGemini = async (messages, options = {}) => {
  const model = options.model || GEMINI_MODEL;
  let geminiContents = convertToGeminiFormat(messages);
  geminiContents = truncateGeminiContents(geminiContents);

  const messageId = options.messageId || randomUUID();
  const requestId = options.requestId || randomUUID();

  if (__DEV__) {
    console.log(`🤖 Gemini call (${model}) mid=${messageId}`);
  }

  const generationConfig = {
    temperature: options.temperature ?? 0.4,
    maxOutputTokens: options.maxTokens || options.maxOutputTokens || 800,
    topP: 0.8,
    topK: 40,
  };

  if (options.responseMimeType) {
    generationConfig.responseMimeType = options.responseMimeType;
  }

  const thinkingBudget = options.thinkingBudget ?? THINKING_BUDGET;
  if (thinkingBudget !== undefined) {
    generationConfig.thinkingConfig = { thinkingBudget };
  }

  const innerBody = {
    model,
    contents: geminiContents,
    generationConfig,
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  const envelope = {
    ...innerBody,
    messageId,
    requestId,
  };

  const proxyOpts = {
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    transportRetries: options.transportRetries ?? 1,
  };

  const directKey = getDirectApiKey();
  if (useDirectOnlyDev() && directKey) {
    await consumeRateLimitSlotOrThrow();
    const data = await fetchGeminiDirect(innerBody, options, directKey);
    return parseGeminiResponse(data);
  }

  const wrapped = await invokeProxy(envelope, proxyOpts);
  return parseGeminiResponse(wrapped.gemini);
};

export const getDailyUsage = async () => {
  try {
    const { data, error } = await supabase.rpc('get_api_usage_today');
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      used: Number(row?.used ?? 0),
      date: row?.request_date ?? null,
    };
  } catch {
    return null;
  }
};

const dataUrlToInlinePart = (url) => {
  const m = String(url).match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const maxB64 = 400_000;
  let b64 = m[2];
  if (b64.length > maxB64) b64 = b64.slice(0, maxB64);
  return { inlineData: { mimeType: m[1] || 'image/jpeg', data: b64 } };
};

const userContentToParts = (content, systemPrefix) => {
  const prefix = systemPrefix ? String(systemPrefix).trimEnd() + '\n\n' : '';

  if (typeof content === 'string') {
    return [{ text: prefix + content }];
  }

  if (!Array.isArray(content)) {
    return [{ text: prefix + String(content ?? '') }];
  }

  let firstText = true;
  const parts = [];

  for (const item of content) {
    if (item?.type === 'text') {
      const t = item.text ?? '';
      parts.push({ text: firstText ? prefix + t : t });
      firstText = false;
    } else if (item?.type === 'image_url' && item.image_url?.url) {
      const inline = dataUrlToInlinePart(item.image_url.url);
      if (inline) parts.push(inline);
    }
  }

  if (parts.length === 0) {
    parts.push({ text: prefix });
  } else if (prefix && parts[0] && !('text' in parts[0])) {
    parts.unshift({ text: prefix });
  }

  return parts;
};

const convertToGeminiFormat = (messages) => {
  const geminiContents = [];
  let systemAccum = '';

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemAccum += (msg.content ?? '') + '\n\n';
      continue;
    }

    if (msg.role === 'user') {
      const parts = userContentToParts(msg.content, systemAccum);
      systemAccum = '';
      geminiContents.push({ role: 'user', parts });
      continue;
    }

    if (msg.role === 'assistant') {
      const text = typeof msg.content === 'string' ? msg.content : '';
      geminiContents.push({ role: 'model', parts: [{ text }] });
    }
  }

  if (systemAccum.trim() && geminiContents.length === 0) {
    geminiContents.push({ role: 'user', parts: [{ text: systemAccum.trim() }] });
  }

  return geminiContents;
};

export const chatWithGemini = async (
  userMessage,
  systemPrompt = '',
  conversationHistory = [],
  extraOptions = {},
) => {
  const messages = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  for (const msg of conversationHistory) {
    messages.push({
      role: msg.isBot ? 'assistant' : 'user',
      content: msg.text || msg.content || '',
    });
  }

  messages.push({ role: 'user', content: userMessage });

  return await callGemini(messages, extraOptions);
};

export default {
  callGemini,
  chatWithGemini,
  getDailyUsage,
  RateLimitError,
  GeminiInvocationError,
  GEMINI_MODEL,
};
