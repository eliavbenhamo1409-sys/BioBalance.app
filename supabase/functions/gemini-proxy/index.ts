// ============================================================
// Supabase Edge Function: gemini-proxy (structured responses)
// ============================================================
// Secrets: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY,
//          SUPABASE_SERVICE_ROLE_KEY
// Optional: GEMINI_API_KEY_FALLBACK, DAILY_MESSAGE_LIMIT
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_API_KEY_FALLBACK = Deno.env.get("GEMINI_API_KEY_FALLBACK") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const DAILY_LIMIT_RAW = Number(Deno.env.get("DAILY_MESSAGE_LIMIT") ?? "60");
const DAILY_LIMIT = Math.max(
  60,
  Number.isFinite(DAILY_LIMIT_RAW) && DAILY_LIMIT_RAW > 0 ? DAILY_LIMIT_RAW : 60,
);

const UPSTREAM_TIMEOUT_MS = 25_000;
const MAX_BODY_BYTES = 1_800_000;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-app-version, x-app-build, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GeminiEnvelope = {
  messageId?: string;
  requestId?: string;
  model?: string;
  contents?: unknown;
  generationConfig?: unknown;
  safetySettings?: unknown;
};

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function parseJwtSub(authHeader: string): string | null {
  try {
    const raw = authHeader.replace(/^Bearer\s+/i, "").trim();
    const parts = raw.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1]));
    const sub = payload?.sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

function uuidOk(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}

async function fetchGeminiUpstream(
  model: string,
  bodyPayload: Record<string, unknown>,
  apiKey: string,
): Promise<Response> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({
      ok: false,
      errorKind: "method_not_allowed",
      requestId: "",
      retryable: false,
    }, 405);
  }

  const hdrReqId = req.headers.get("x-request-id") ?? "";

  if (!GEMINI_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[gemini-proxy] missing secrets");
    return jsonResponse({
      ok: false,
      errorKind: "server_misconfigured",
      requestId: hdrReqId,
      retryable: false,
    }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({
      ok: false,
      errorKind: "unauthorized",
      requestId: hdrReqId,
      retryable: false,
    }, 401);
  }

  const userId = parseJwtSub(authHeader);
  if (!userId) {
    return jsonResponse({
      ok: false,
      errorKind: "invalid_token",
      requestId: hdrReqId,
      retryable: false,
    }, 401);
  }

  const buf = await req.arrayBuffer();
  if (buf.byteLength > MAX_BODY_BYTES) {
    return jsonResponse({
      ok: false,
      errorKind: "payload_too_large",
      requestId: hdrReqId,
      retryable: false,
    }, 413);
  }

  let payload: GeminiEnvelope;
  try {
    payload = JSON.parse(new TextDecoder().decode(buf));
  } catch {
    return jsonResponse({
      ok: false,
      errorKind: "invalid_json",
      requestId: hdrReqId,
      retryable: false,
    }, 400);
  }

  const messageId = String(payload.messageId ?? "").trim();
  const requestId = String(payload.requestId ?? "").trim() || hdrReqId;
  const appVersion = req.headers.get("x-app-version") ?? "";
  const appBuild = req.headers.get("x-app-build") ?? "";

  if (!uuidOk(messageId) || !uuidOk(requestId)) {
    return jsonResponse({
      ok: false,
      errorKind: "missing_ids",
      requestId,
      retryable: false,
    }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: killRow, error: killErr } = await admin
    .from("ai_runtime_config")
    .select("ai_chat_enabled")
    .eq("id", 1)
    .maybeSingle();

  if (killErr) {
    console.error("[gemini-proxy] kill switch read:", killErr.message);
    return jsonResponse({
      ok: false,
      errorKind: "upstream",
      requestId,
      retryable: true,
    }, 503);
  }

  if (killRow && killRow.ai_chat_enabled === false) {
    console.warn(
      `[gemini-proxy] AI disabled rid=${requestId} mid=${messageId} app=${appVersion}(${appBuild})`,
    );
    return jsonResponse({
      ok: false,
      errorKind: "disabled",
      requestId,
      retryable: true,
    }, 503);
  }

  const { data: preRows, error: preErr } = await admin.rpc(
    "gemini_preflight_admin",
    {
      p_user_id: userId,
      p_message_id: messageId,
      p_request_id: requestId,
      p_daily_limit: DAILY_LIMIT,
      p_max_attempts_per_message: 12,
      p_max_attempts_per_minute: 24,
    },
  );

  if (preErr) {
    console.error("[gemini-proxy] preflight:", preErr.message, requestId);
    return jsonResponse({
      ok: false,
      errorKind: "upstream",
      requestId,
      retryable: true,
    }, 502);
  }

  const pre = Array.isArray(preRows) ? preRows[0] : preRows;
  const outcome = String(pre?.outcome ?? "");

  console.log(
    `[gemini-proxy] preflight=${outcome} rid=${requestId} mid=${messageId} app=${appVersion}(${appBuild})`,
  );

  if (outcome === "replay") {
    const gemini = pre?.gemini_response;
    return jsonResponse({
      ok: true,
      replay: true,
      requestId,
      messageId,
      gemini,
    }, 200);
  }

  if (outcome === "quota_exceeded") {
    const lim = Number(pre?.daily_limit ?? DAILY_LIMIT);
    const used = Number(pre?.daily_used ?? lim);
    return jsonResponse({
      ok: false,
      errorKind: "quota",
      code: "DAILY_LIMIT_EXCEEDED",
      message:
        `הגעת למכסה היומית של ${lim} הודעות. נסה שוב מחר 🌙`,
      used,
      limit: lim,
      requestId,
      retryable: false,
    }, 429);
  }

  if (outcome === "abuse" || outcome === "too_many_attempts") {
    return jsonResponse({
      ok: false,
      errorKind: outcome === "abuse" ? "abuse" : "too_many_attempts",
      requestId,
      retryable: false,
    }, 429);
  }

  if (outcome !== "proceed") {
    return jsonResponse({
      ok: false,
      errorKind: "upstream",
      requestId,
      retryable: true,
    }, 502);
  }

  const {
    model = "gemini-2.5-flash",
    contents,
    generationConfig,
    safetySettings,
  } = payload;

  if (!contents) {
    await admin.rpc("gemini_commit_failure_admin", {
      p_user_id: userId,
      p_message_id: messageId,
      p_error_kind: "missing_contents",
    });
    return jsonResponse({
      ok: false,
      errorKind: "missing_contents",
      requestId,
      retryable: false,
    }, 400);
  }

  const upstreamBody = { contents, generationConfig, safetySettings };

  let upstream: Response;
  let data: unknown = {};

  try {
    upstream = await fetchGeminiUpstream(
      model,
      upstreamBody as Record<string, unknown>,
      GEMINI_API_KEY,
    );
    data = await upstream.json().catch(() => ({}));
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    await admin.rpc("gemini_commit_failure_admin", {
      p_user_id: userId,
      p_message_id: messageId,
      p_error_kind: aborted ? "timeout" : "upstream",
    });
    return jsonResponse({
      ok: false,
      errorKind: aborted ? "timeout" : "upstream",
      requestId,
      retryable: true,
    }, aborted ? 504 : 502);
  }

  const fallbackKey = GEMINI_API_KEY_FALLBACK.trim();
  const useFallback =
    !upstream.ok &&
    fallbackKey.length > 10 &&
    (upstream.status === 429 ||
      upstream.status === 403 ||
      upstream.status >= 500);

  if (useFallback) {
    try {
      const up2 = await fetchGeminiUpstream(
        model,
        upstreamBody as Record<string, unknown>,
        fallbackKey,
      );
      const data2 = await up2.json().catch(() => ({}));
      upstream = up2;
      data = data2;
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      await admin.rpc("gemini_commit_failure_admin", {
        p_user_id: userId,
        p_message_id: messageId,
        p_error_kind: aborted ? "timeout" : "upstream",
      });
      return jsonResponse({
        ok: false,
        errorKind: aborted ? "timeout" : "upstream",
        requestId,
        retryable: true,
      }, aborted ? 504 : 502);
    }
  }

  if (!upstream.ok) {
    await admin.rpc("gemini_commit_failure_admin", {
      p_user_id: userId,
      p_message_id: messageId,
      p_error_kind: "upstream",
    });
    console.error(
      `[gemini-proxy] Gemini HTTP ${upstream.status} rid=${requestId}`,
      JSON.stringify(data).slice(0, 400),
    );
    const retryable =
      upstream.status >= 500 || upstream.status === 429 || upstream.status === 403;
    return jsonResponse({
      ok: false,
      errorKind: "upstream",
      requestId,
      retryable,
    }, upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502);
  }

  const { data: commitRows, error: commitErr } = await admin.rpc(
    "gemini_commit_success_admin",
    {
      p_user_id: userId,
      p_message_id: messageId,
      p_gemini_response: data,
      p_daily_limit: DAILY_LIMIT,
    },
  );

  if (commitErr) {
    console.error("[gemini-proxy] commit success:", commitErr.message);
    return jsonResponse({
      ok: false,
      errorKind: "upstream",
      requestId,
      retryable: true,
    }, 502);
  }

  const cr = Array.isArray(commitRows) ? commitRows[0] : commitRows;

  return jsonResponse({
    ok: true,
    replay: false,
    requestId,
    messageId,
    gemini: data,
    quota: {
      countedTowardDaily: cr?.did_count_toward_quota ?? true,
      newDailyCount: cr?.new_daily_count,
      dailyLimit: cr?.daily_limit,
    },
  }, 200);
});
