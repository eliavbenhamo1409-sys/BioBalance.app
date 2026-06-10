// ============================================================
// Smart Chatbot - Context-Aware Conversational AI
// ============================================================
// Built with intent classification, entity extraction, and context awareness
// Now powered by Gemini 3.5 Flash for nutrition estimates!

import { callGemini, RateLimitError } from './geminiClient';
import {
  enrichAddFoodFoods,
  formatFoodLoggedReply,
} from './chatFoodResolver';
import { verifyResolvedFoodPlan } from './foodVerifier';
import { userMessageImpliesFoodQuantity, needsQuantityPrompt } from '../utils/userMessageQuantityHints';
import { buildQuantityPromptRulesBlock } from './quantityPromptRules';

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const e = new Error('Cancelled');
    e.name = 'AbortError';
    e.code = 'USER_CANCEL';
    throw e;
  }
}

const _chatLog = console.log.bind(console);
const devLog = (...args) => {
  if (__DEV__) _chatLog(...args);
};

export function newMealGroupId() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================
// INTENT TYPES
// ============================================================
export const INTENTS = {
  REPORT_FOOD: 'report_food',           // "אכלתי פסטה", "בננה 2"
  ASK_ALTERNATIVE: 'ask_alternative',    // "מה אפשר במקום...", "חליפה ל..."
  ASK_RECIPE: 'ask_recipe',             // "מתכון ל...", "איך מכינים..."
  ASK_ADVICE: 'ask_advice',             // "מה בריא יותר?", "האם כדאי..."
  ASK_MEAL_PLAN: 'ask_meal_plan',       // "תכנן לי יום", "מה לאכול היום"
  ADD_WATER: 'add_water',               // "שתיתי מים", "כוס מים"
  CONFIRM: 'confirm',                   // "כן", "נכון", "אישור"
  CANCEL: 'cancel',                     // "לא", "ביטול", "בטל"
  PROVIDE_QUANTITY: 'provide_quantity', // "200 גרם", "150"
  GENERAL_CHAT: 'general_chat',         // כל השאר
};

// ============================================================
// MAIN FUNCTION: Process User Message
// ============================================================
export const processUserMessage = async (userMessage, context) => {
  const {
    conversationHistory = [],
    pendingAction = null,       // { type: 'waiting_quantity', foods: [...] }
    dailyStats = {},            // { calories: 500, protein: 30, fat: 20, water: 2 }
    targets = {},               // { calories: 2000, protein: 100, fat: 70, water: 8 }
    userName = '',
    timeOfDay = getTimeOfDay(),
    signal = undefined,
  } = context;

  throwIfAborted(signal);

  devLog('📩 Processing message:', userMessage);
  devLog('📊 Daily stats:', dailyStats);
  devLog('🎯 Targets:', targets);

  // Extract-first: Gemini provides name + quantity + per-100g nutrition inline.
  const caloriesLeft = (targets.calories || 2000) - (dailyStats.calories || 0);
  const systemPrompt = buildSystemPrompt({ ...context, caloriesLeft });
  
  // Prepare conversation for API - limit history to prevent confusion
  const recentHistory = conversationHistory.slice(-4); // Only last 4 messages
  const messages = [
    { role: 'system', content: systemPrompt },
    ...formatConversationHistory(recentHistory),
    { role: 'user', content: userMessage }
  ];

  try {
    const chatExtractOpts = {
      maxTokens: 2048,
      thinkingLevel: 'minimal',
      responseMimeType: 'application/json',
      signal,
    };

    const response = await callGemini(messages, chatExtractOpts);

    devLog('🤖 Raw Gemini response received');

    // Parse the structured response
    const resultFromModel = parseSmartResponse(response, context);
    let result = resultFromModel;

    const mergeExtractedWater = (res) => {
      const waterGlassesEarly = extractWaterGlasses(userMessage);
      if (waterGlassesEarly <= 0) return;
      if (res.action?.type === 'add_food') {
        res.action.data = res.action.data || {};
        res.action.data.water_glasses =
          (res.action.data.water_glasses || 0) + waterGlassesEarly;
      } else if (res.action?.type === 'add_water') {
        res.action.data = res.action.data || {};
        res.action.data.glasses = (res.action.data.glasses || 0) + waterGlassesEarly;
      } else {
        res.action = { type: 'add_water', data: { glasses: waterGlassesEarly } };
      }
    };

    mergeExtractedWater(result);

    if (
      result.action?.type === 'ask_quantity' &&
      userMessageImpliesFoodQuantity(userMessage)
    ) {
      devLog('🔁 Retrying: model returned ask_quantity but message has quantity cues');
      throwIfAborted(signal);
      const retrySystem = buildSystemPrompt(
        { ...context, caloriesLeft, forceNoAskQuantity: true },
      );
      const retryMessages = [
        { role: 'system', content: retrySystem },
        ...formatConversationHistory(recentHistory),
        { role: 'user', content: userMessage },
      ];
      const retryResp = await callGemini(retryMessages, chatExtractOpts);
      result = parseSmartResponse(retryResp, context);
      mergeExtractedWater(result);
    }

    if (
      result.action?.type === 'ask_quantity' &&
      userMessageImpliesFoodQuantity(userMessage)
    ) {
      devLog('⚠️ ask_quantity persists after retry; stripping action');
      result = {
        intent: result.intent || INTENTS.GENERAL_CHAT,
        response:
          (result.response && String(result.response).trim()) ||
          'לא הצלחתי לרשום מההודעה. שלח שוב או נסח מחדש.',
        action: null,
      };
    }

    // Quantity card gate — before enrichment/save (uses AI flag + rules, not list-only)
    if (result.action?.type === 'add_food' && result.action.data?.foods?.length) {
      const rawFoods = result.action.data.foods;
      const promptMeta = needsQuantityPrompt(rawFoods, userMessage);
      if (promptMeta) {
        result.action.data.quantityPrompt = promptMeta;
        result.action.data.pendingRawFoods = rawFoods.map((f) => ({ ...f }));
        result.action.data.meal_group_id =
          context.mealGroupOverride || newMealGroupId();
        result.action.data.foods = [];
        result.response =
          promptMeta.promptTitle || `כמה ${promptMeta.food.name} אכלת?`;
        if (result.response) {
          result.response = cleanDuplicateContent(result.response);
        }
        devLog('📏 Quantity prompt gate:', promptMeta.food?.name);
        return result;
      }
    }

    // Gemini inline nutrition: model extracts name + quantity + per-100g macros
    if (result.action?.type === 'add_food' && result.action.data?.foods?.length) {
      try {
        const geminiResponseBackup =
          typeof result.response === 'string' && result.response.trim()
            ? result.response.trim()
            : '';
        const enriched = await enrichAddFoodFoods(result.action.data.foods, { signal });

        // Final Gemini sanity-check ("AI signature"): audits the resolved
        // {name, grams, kcal/100g} against the original user text and may
        // correct grams or flag mis-identified items. Silently degrades to
        // the pre-verifier result on timeout / rate-limit / parse failure.
        let verifierCorrections = [];
        let verifierApproved = [];
        let resolvedFoods = enriched.resolvedFoods;
        let needsClarification = enriched.needsClarification;
        if (resolvedFoods?.length) {
          throwIfAborted(signal);
          const verified = await verifyResolvedFoodPlan({
            userMessage,
            foods: resolvedFoods,
            signal,
          });
          resolvedFoods = verified.foods;
          verifierCorrections = verified.corrections;
          verifierApproved = verified.approved;
          if (verified.clarifications?.length) {
            needsClarification = [
              ...(needsClarification || []),
              ...verified.clarifications,
            ];
          }
        }

        result.action.data.foods = resolvedFoods;
        result.action.data.needsClarification = needsClarification;
        result.action.data.skippedOverCap = enriched.skippedOverCap;
        const wg = Number(result.action.data.water_glasses) || 0;
        const hasSaved = resolvedFoods?.length > 0;

        if (hasSaved) {
          result.action.data.meal_group_id = context.mealGroupOverride || newMealGroupId();
          result.action.data.source_message_text =
            String(userMessage).slice(0, 500);
        } else {
          delete result.action.data.meal_group_id;
          delete result.action.data.source_message_text;
        }
        if (hasSaved) {
          // Direct log — no confirmation card. The bot reply will include a
          // small edit button so the user can tweak the meal in the meals
          // screen if the auto-estimate is off. Keeping the verifier hints
          // visible in the text gives transparency without breaking flow.
          let replyBody = formatFoodLoggedReply(resolvedFoods, {
            dailyStats: context.dailyStats,
            targets: context.targets,
            needsClarification,
            skippedOverCap: enriched.skippedOverCap,
            estimateFallbackCount: enriched.estimateFallbackCount ?? 0,
            verifierCorrections,
            verifierApproved,
          });
          if (wg > 0) {
            replyBody += `\n💧 ${wg} כוסות מים`;
          }
          result.response = replyBody;
        } else if (geminiResponseBackup) {
          // Nothing resolved deterministically, but the model already produced
          // a helpful response. Preserve it so the user doesn't see a hard
          // "needs clarification" wall on every niche food. Still strip the
          // add_food action so the meal isn't silently logged with bad data.
          result.action = null;
          result.response = geminiResponseBackup;
        } else {
          // No model response either → keep the clarification UX as last resort.
          let replyBody = formatFoodLoggedReply(resolvedFoods, {
            dailyStats: context.dailyStats,
            targets: context.targets,
            needsClarification,
            skippedOverCap: enriched.skippedOverCap,
            estimateFallbackCount: enriched.estimateFallbackCount ?? 0,
            verifierCorrections,
            verifierApproved,
          });
          if (wg > 0) {
            replyBody += `\n💧 ${wg} כוסות מים`;
          }
          result.response = replyBody;
        }
      } catch (e) {
        if (e?.code === 'USER_CANCEL') throw e;
        devLog('enrichAddFoodFoods:', e.message);
        result = {
          intent: INTENTS.GENERAL_CHAT,
          response:
            'לא הצלחתי לסיים את הרישום התזונתי. נסה שוב או פרט מה אכלת (שם בעברית + גרם).',
          action: null,
        };
      }
    }

    // Ensure single, clean response
    if (result.response) {
      // Remove any duplicate content
      result.response = cleanDuplicateContent(result.response);
    }
    
    devLog('✅ Final response:', result.response?.substring(0, 100));
    return result;
    
  } catch (error) {
    // Propagate rate-limit errors so the UI can show a dedicated banner
    // and engage its cooldown / circuit breaker. Everything else falls
    // through to the generic "something went wrong" response.
    if (error?.code === 'USER_CANCEL') {
      throw error;
    }
    if (error instanceof RateLimitError || error?.name === 'RateLimitError') {
      throw error;
    }
    if (error?.code === 'UPDATE_REQUIRED' || error?.name === 'UpdateRequiredError') {
      throw error;
    }
    console.error('❌ Smart chatbot error:', error);
    const msg = String(error?.message || '');
    const permissionBlocked =
      /Gemini חסום|PERMISSION_DENIED|denied access/i.test(msg) ||
      (error?.status === 403);
    return {
      intent: INTENTS.GENERAL_CHAT,
      response: permissionBlocked
        ? 'שירות ה-AI חסום כרגע (מפתח Gemini לא תקף או שגוגל חסמו את הפרויקט). הוסף GEMINI_API_KEY תקין ל-.env והפעל מחדש את Metro, או עדכן את סוד GEMINI_API_KEY ב-Supabase.'
        : 'סליחה, משהו השתבש. נסה שוב? 😅',
      action: null,
    };
  }
};

/**
 * After user skips the quantity card, enrich and format the AI's default estimate.
 */
export async function completePendingAddFood(pendingResult, userMessage, context) {
  const data = pendingResult?.action?.data;
  const rawFoods = data?.pendingRawFoods;
  if (!rawFoods?.length) return pendingResult;

  const signal = context?.signal;
  const result = {
    intent: pendingResult.intent || INTENTS.REPORT_FOOD,
    action: {
      type: 'add_food',
      data: {
        water_glasses: data.water_glasses,
        meal_group_id: data.meal_group_id || context.mealGroupOverride || newMealGroupId(),
      },
    },
    response: pendingResult.response,
  };

  try {
    throwIfAborted(signal);
    const enriched = await enrichAddFoodFoods(rawFoods, { signal });
    let resolvedFoods = enriched.resolvedFoods;
    let needsClarification = enriched.needsClarification;
    let verifierCorrections = [];
    let verifierApproved = [];

    if (resolvedFoods?.length) {
      throwIfAborted(signal);
      const verified = await verifyResolvedFoodPlan({
        userMessage,
        foods: resolvedFoods,
        signal,
      });
      resolvedFoods = verified.foods;
      verifierCorrections = verified.corrections;
      verifierApproved = verified.approved;
      if (verified.clarifications?.length) {
        needsClarification = [
          ...(needsClarification || []),
          ...verified.clarifications,
        ];
      }
    }

    result.action.data.foods = resolvedFoods;
    result.action.data.needsClarification = needsClarification;
    result.action.data.skippedOverCap = enriched.skippedOverCap;
    result.action.data.source_message_text = String(userMessage).slice(0, 500);

    const wg = Number(data.water_glasses) || 0;
    if (resolvedFoods?.length) {
      let replyBody = formatFoodLoggedReply(resolvedFoods, {
        dailyStats: context.dailyStats,
        targets: context.targets,
        needsClarification,
        skippedOverCap: enriched.skippedOverCap,
        estimateFallbackCount: enriched.estimateFallbackCount ?? 0,
        verifierCorrections,
        verifierApproved,
      });
      if (wg > 0) replyBody += `\n💧 ${wg} כוסות מים`;
      result.response = replyBody;
    }
  } catch (e) {
    if (e?.code === 'USER_CANCEL') throw e;
    devLog('completePendingAddFood:', e.message);
    return {
      intent: INTENTS.GENERAL_CHAT,
      response:
        'לא הצלחתי לסיים את הרישום התזונתי. נסה שוב או פרט מה אכלת (שם בעברית + גרם).',
      action: null,
    };
  }

  if (result.response) {
    result.response = cleanDuplicateContent(result.response);
  }
  return result;
}

// ============================================================
// HELPER: Clean duplicate content from response
// ============================================================
const cleanDuplicateContent = (text) => {
  if (!text) return text;
  
  // Split by newlines and remove duplicate lines
  const lines = text.split('\n');
  const seen = new Set();
  const uniqueLines = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines or keep them for formatting
    if (!trimmed) {
      uniqueLines.push(line);
      continue;
    }
    // Skip if we've seen this exact line before
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      uniqueLines.push(line);
    }
  }
  
  return uniqueLines.join('\n').trim();
};

// ============================================================
// HELPER: Extract water glasses from text
// ============================================================
const extractWaterGlasses = (text = '') => {
  const lower = text.toLowerCase();
  // Pattern: "<number> כוס/כוסות מים" or "number cups water"
  const regex = /(\d+(?:\.\d+)?)\s*(?:כוסות?|cups?)\s*(?:של\s*)?מים/;
  const match = lower.match(regex);
  if (match) {
    const num = parseFloat(match[1]);
    if (!isNaN(num) && num > 0) return Math.round(num);
  }
  // If mentions both "כוס" and "מים" without a number, assume 1
  if (lower.includes('כוס') && lower.includes('מים')) {
    return 1;
  }
  return 0;
};

// ============================================================
// BUILD SYSTEM PROMPT
// ============================================================
const buildSystemPrompt = (context) => {
  const {
    pendingAction,
    dailyStats = {},
    targets = {},
    userName = '',
    goal = 'maintain', // cut, maintain, lean_bulk, bulk
    forceNoAskQuantity = false,
  } = context;

  const caloriesLeft = (targets.calories || 2000) - (dailyStats.calories || 0);
  const proteinLeft = (targets.protein || 100) - (dailyStats.protein || 0);
  const waterLeft = (targets.water || 8) - (dailyStats.water_glasses || 0);
  
  // Goal-specific coaching style
  const goalText = {
    cut: 'ירידה במשקל / חיטוב',
    maintain: 'שמירה על משקל',
    lean_bulk: 'עלייה מתונה במסה (Lean Bulk)',
    bulk: 'עלייה מהירה במסה (Bulk)',
  }[goal] || 'שמירה על משקל';

  // Get exact current time
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
  
  // Determine meal period and recommendations with specific times
  let mealContext = '';
  let nextMealTime = '';
  let nextMealSuggestion = '';
  
  if (currentHour >= 5 && currentHour < 10) {
    nextMealTime = '10:30';
    nextMealSuggestion = 'נשנוש קל - פרי או יוגורט';
    mealContext = `
🕐 השעה עכשיו: ${timeString} (בוקר)
📌 הארוחה הבאה: ב-${nextMealTime} - ${nextMealSuggestion}
💡 אם זו ארוחת בוקר - תמליץ על נשנוש ב-10:30`;
  } else if (currentHour >= 10 && currentHour < 12) {
    nextMealTime = '13:00';
    nextMealSuggestion = 'ארוחת צהריים מאוזנת';
    mealContext = `
🕐 השעה עכשיו: ${timeString} (לפני צהריים)
📌 הארוחה הבאה: ב-${nextMealTime} - ${nextMealSuggestion}
💡 אם זה נשנוש - תמליץ על ארוחת צהריים ב-13:00`;
  } else if (currentHour >= 12 && currentHour < 14) {
    nextMealTime = '16:00';
    nextMealSuggestion = 'נשנוש אחה"צ - חטיף חלבון או פרי';
    mealContext = `
🕐 השעה עכשיו: ${timeString} (צהריים)
📌 הארוחה הבאה: ב-${nextMealTime} - ${nextMealSuggestion}
💡 אם זו ארוחת צהריים - תמליץ על נשנוש ב-16:00`;
  } else if (currentHour >= 14 && currentHour < 17) {
    nextMealTime = '19:00';
    nextMealSuggestion = 'ארוחת ערב עשירה בחלבון';
    mealContext = `
🕐 השעה עכשיו: ${timeString} (אחה"צ)
📌 הארוחה הבאה: ב-${nextMealTime} - ${nextMealSuggestion}
💡 אם זה נשנוש - תמליץ על ארוחת ערב ב-19:00`;
  } else if (currentHour >= 17 && currentHour < 20) {
    nextMealTime = '21:00';
    nextMealSuggestion = 'נשנוש קל לפני שינה - יוגורט/קוטג\'';
    mealContext = `
🕐 השעה עכשיו: ${timeString} (ערב)
📌 הארוחה הבאה: ב-${nextMealTime} - ${nextMealSuggestion}
💡 אם זו ארוחת ערב - תמליץ על נשנוש קל ב-21:00 אם נשארו קלוריות`;
  } else if (currentHour >= 20 && currentHour < 23) {
    nextMealTime = 'מחר בבוקר';
    nextMealSuggestion = 'ארוחת בוקר';
    mealContext = `
🕐 השעה עכשיו: ${timeString} (ערב)
💡 זה בסדר לאכול! אל תשפוט, פשוט רשום ותמשיך`;
  } else {
    nextMealTime = 'מחר בבוקר';
    nextMealSuggestion = 'ארוחת בוקר';
    mealContext = `
🕐 השעה עכשיו: ${timeString} (לילה)
💡 זה בסדר לאכול בכל שעה! רשום בלי שיפוטיות`;
  }

  // Pending action context (legacy camera/3D flow only; the chat flow no
  // longer leaves the user "waiting for a quantity").
  let pendingContext = '';
  if (pendingAction?.type === 'waiting_quantity') {
    const foodNames = pendingAction.foods.map((f) => f.name).join(', ');
    pendingContext = `
⚠️ הקשר: ממתינים לכמות למאכל(ים): **${foodNames}**

📩 אם המשתמש כותב **בצ'אט**:
• **מספרים** (למשל "200", "200 גרם", "בערך מ־80") — פרש כמות למאכל(ים) הממתינים (סדר כמו ברשימה למעלה כשיש כמה).
• **בלי מספרים — תיאור בשפת דיבור** ("חצי קערה", "חופן גדול") — **חובה להמיר בעצמך לגרמים משוערים** ולרשום.

🎯 **איך להחזיר JSON:**
החזר \`"intent": "report_food"\` ו־action \`"add_food"\` עם \`foods\`: לכל מאכל ממתין פריט עם **אותו שם עברי** + שדה נומרי **grams** = ההערכה שלך מתוך התיאור.
`;
  }

  const quantityGuardBlock = forceNoAskQuantity
    ? `
═══════════════════════════════════════
🚨 הודעה זו: נמסרה כמות או מידה — אסור ask_quantity
═══════════════════════════════════════
חובה: intent report_food + action add_food בלבד.
פרק foods עם name + quantity + unit (או grams). רישום ישיר למאזן.
`
    : '';

  return `אתה Bio - עוזר תזונה אישי, חכם, חברותי ותומך.
דבר בעברית טבעית, בגובה העיניים, בלי להיות רובוטי.

🚨🚨🚨 כללים קריטיים - חובה לעקוב! 🚨🚨🚨
────────────────────────────────────────
1. **אל תחשוב בקול רם!** - לא "Okay", לא "Let me think", לא "Wait"
2. **החזר רק JSON** - לא טקסט לפני, לא טקסט אחרי
3. **עברית בלבד** - אף פעם אנגלית בתשובה
4. **תשובה אחת** - לא לחזור על עצמך

❌ שגוי:
Okay, the user wants... *Wait* let me think...
{"intent": "report_food", "response": "..."}

✅ נכון:
{"intent": "report_food", "response": "✅ נרשם: פסטה..."}
${quantityGuardBlock}

═══════════════════════════════════════
📊 מצב נוכחי של המשתמש${userName ? ` (${userName})` : ''}:
═══════════════════════════════════════
• קלוריות שצרך היום: ${dailyStats.calories || 0} מתוך ${targets.calories || 2000}
• קלוריות שנותרו: ${caloriesLeft}
• חלבון שנותר: ${proteinLeft}g מתוך ${targets.protein || 100}g
• מים שנותרו: ${waterLeft} כוסות מתוך ${targets.water || 8}
• 🎯 מטרת המשתמש: ${goalText}
${mealContext}
${pendingContext}

═══════════════════════════════════════
🎯🎯🎯 התאמה למטרה - קריטי! 🎯🎯🎯
═══════════════════════════════════════
${goal === 'cut' ? `
**מטרה: ירידה במשקל / חיטוב**
────────────────────────────────────────
📌 עקרונות:
• ניהול קלוריות חכם - לא לבזבז על מאכלים ריקים
• חלבון גבוה = שובע ושמירה על שריר
• נפח גדול עם מעט קלוריות (ירקות, סלטים)
• שומנים בריאים במידה

💬 סגנון דיבור:
• תומך ואסטרטגי, לא דוחף קלוריות
• "בחירה מצוינת לשמירה על שובע"
• "זה ימלא אותך בלי להכביד"

🍽️ כשנשאל "מה לאכול":
• המלץ על ארוחות משביעות ודלות קלוריות
• עדיף: סלט ענק + חזה עוף/טונה, חביתת ירקות, יוגורט 0%
• הימנע: פסטה כבדה, מזון מטוגן, קינוחים

⚠️ כשנשארו מעט קלוריות:
• "נשארו ${caloriesLeft} קל' - בוא נשמור אותן לארוחה משביעה"
• המלץ על ירקות, חלבון רזה, מרקים
` : ''}${goal === 'bulk' || goal === 'lean_bulk' ? `
**מטרה: ${goal === 'bulk' ? 'עלייה מהירה במסה (Bulk)' : 'עלייה מתונה במסה (Lean Bulk)'}**
────────────────────────────────────────
📌 עקרונות:
• צפיפות קלורית גבוהה - לסגור את היעד!
• חלבון בכל ארוחה לבניית שריר
• לא לפחד משומנים בריאים
• פחמימות = דלק לאימונים

💬 סגנון דיבור:
• אנרגטי ודוחף, "בוא נסגור את היעד"
• "מעולה, עוד קצת ונגיע!"
• "תוסיף עוד משהו דחוס"

🍽️ כשנשאל "מה לאכול":
• המלץ על ארוחות צפופות בקלוריות
• עדיף: שייק עם בננה+חמאת בוטנים+שיבולת, אורז+עוף+אבוקדו, פסטה עם בשר
• תוספות מומלצות: טחינה, אגוזים, שמן זית, אבוקדו

⚠️ כשנשארו הרבה קלוריות:
• "עדיין נשארו ${caloriesLeft} קל' - בוא נדחוף!"
• "תעשה שייק דחוס או תוסיף אגוזים"
• אל תגיד "זה בסדר" - תדחוף לסגור את היעד
` : ''}${goal === 'maintain' ? `
**מטרה: שמירה על משקל**
────────────────────────────────────────
📌 עקרונות:
• איזון בין כל קבוצות המזון
• לא להגזים ולא לחסר
• גמישות ומאזן

💬 סגנון דיבור:
• נינוח ומאוזן
• "בחירה טובה"
• "שומר על איזון יפה"

🍽️ כשנשאל "מה לאכול":
• המלץ על ארוחות מאוזנות
• חלבון + פחמימה + ירקות + שומן בריא
• גמישות בבחירות
` : ''}

${(dailyStats.calories || 0) === 0 ? `
⚠️⚠️⚠️ שים לב! הלקוח לא הזין שום דבר היום! ⚠️⚠️⚠️
────────────────────────────────────────
השעה כבר ${timeString} והמאזן ריק לחלוטין!

**אם הלקוח שואל שאלה כללית ("מה אתה חושב שאני צריך לאכול עכשיו?"):**
חייב לציין שהוא לא הזין כלום היום ולהציע השלמות!

דוגמה לתשובה נכונה:
"שמתי לב שעדיין לא הזנת שום דבר היום והשעה כבר ${timeString} 🕐

כדי להגיע ליעד של ${targets.calories || 2000} קלוריות, אני ממליץ:

🍳 ארוחה מאוזנת עכשיו:
• 2 ביצים + לחם מלא + ירקות
• או: חזה עוף עם אורז וסלט

🥤 אל תשכח לשתות מים!

ספר לי מה אכלת עד עכשיו ונתחיל לעקוב 💪"
` : ''}

═══════════════════════════════════════
🎯 משימתך: הבן מה המשתמש רוצה והגב בהתאם
═══════════════════════════════════════

📌 זהה את הכוונה (intent) של המשתמש:

1. **report_food** - המשתמש מדווח שאכל משהו
   דוגמאות: "אכלתי פסטה", "בננה", "2 ביצים", "חופן שקדים"
   
2. **ask_alternative** - המשתמש מבקש חליפה/אלטרנטיבה
   דוגמאות: "מה אפשר במקום שקדים?", "חליפה לפסטה", "אני רוצה משהו דומה ל..."
   
3. **ask_recipe** - המשתמש מבקש מתכון
   דוגמאות: "מתכון לחביתה", "איך מכינים שקשוקה"
   
4. **ask_advice** - המשתמש שואל שאלת ייעוץ
   דוגמאות: "מה בריא יותר?", "האם כדאי לאכול...", "כמה קלוריות יש ב..."
   
5. **ask_meal_plan** - המשתמש מבקש תכנון ארוחות
   דוגמאות: "תכנן לי את היום", "מה לאכול לארוחת ערב", "תפריט לשבוע"
   
6. **add_water** - המשתמש מדווח על שתיית מים
   דוגמאות: "שתיתי מים", "כוס מים", "2 כוסות"
   
7. **confirm** - אישור (בהקשר של פעולה ממתינה)
   דוגמאות: "כן", "בסדר", "אישור", "נכון"
   
8. **cancel** - ביטול
   דוגמאות: "לא", "ביטול", "בטל", "עזוב"
   
9. **provide_quantity** - מתן כמות (בהקשר של מזון ממתין)
   דוגמאות: "200 גרם", "150", "כ-100"
   
10. **general_chat** - שיחה כללית
    דוגמאות: "מה שלומך?", "תודה", "ערב טוב"

═══════════════════════════════════════
📦 פורמט התשובה - JSON בלבד!
═══════════════════════════════════════

החזר JSON בפורמט הזה בלבד:

{
  "intent": "report_food|ask_alternative|ask_recipe|ask_advice|ask_meal_plan|add_water|confirm|cancel|provide_quantity|general_chat",
  "response": "התשובה שלך למשתמש",
  "action": null | { "type": "...", "data": { ... } }
}

═══════════════════════════════════════
✍️ כללי עיצוב תשובות בעברית - חשוב מאוד!
═══════════════════════════════════════

פורמט חליפות - העתק בדיוק את המבנה הזה:

"חלופות לכף טחינה:

30 גרם (חופן) שקדים
174 קלוריות | 6 גרם חלבון | 15 גרם שומן

2 כפות חמאת בוטנים
188 קלוריות | 8 גרם חלבון | 16 גרם שומן

חצי אבוקדו בינוני
120 קלוריות | 1.5 גרם חלבון | 11 גרם שומן

בהצלחה! 🥜"

כללים קריטיים:
1. כותרת: "חלופות ל[שם המזון]:" + ירידת שורה
2. שורה ריקה
3. שם המזון + כמות בסוגריים (בשורה אחת)
4. ירידת שורה
5. הערכים התזונתיים עם | כמפריד
6. שורה ריקה
7. חליפה הבאה באותו פורמט
8. בסוף - משפט עידוד קצר עם אימוג'י

דוגמה נוספת לחלבון:

"חלופות ל150 גרם חזה עוף:

200 גרם קוטג' 5%
180 קלוריות | 22 גרם חלבון | 10 גרם שומן

100 גרם טונה בקופסה
130 קלוריות | 29 גרם חלבון | 1 גרם שומן

3 ביצים קשות
234 קלוריות | 18 גרם חלבון | 15 גרם שומן

כולם מקורות חלבון מעולים! 💪"

═══════════════════════════════════════
📋 פירוט ה-actions:
═══════════════════════════════════════

🍕 **add_food** — כשיש למשתמש מאכל(ים) עם כמות (מספרית) ברורה או שניתן להמיר לגרמים בקוד.
לכל פריט ב-JSON: **name** (עברית), **quantity** + **unit** (או **grams** בלבד), וגם ערכים ל-100g:
**kcal_per_100g**, **protein_per_100g**, **fat_per_100g**, **carbs_per_100g** — הערכה שלך, ריאלית לישראל.
יחידות: \`gram\` | \`unit\` | \`slice\` | \`portion\` | כף/כפית/חופן/כוס/קופסה/פחית.
אפשר **grams** במקום quantity+unit אם כבר כתוב "150 גרם".

🚫🚫🚫 חוק קריטי — אסור unit:"gram" בלי מספר גרם מפורש 🚫🚫🚫
────────────────────────────────────────
• \`unit:"gram"\` (או \`grams\` legacy) **מותר רק** כשבהודעת המשתמש מופיע מספר + "גרם" / "g" / "גר׳" / "ק״ג" / "קילו" מפורש (למשל "200 גרם פסטה", "1.5 ק״ג בקר").
• לכל שאר המקרים — בחר את היחידה הטבעית של המאכל:
  - **unit:"unit"** (יחידה) — פיתה, לחמניה, ביצה, בננה, תפוח, תפוז, סנדוויץ׳/כריך, באגט, המבורגר, פיצה (פרוסה), קרואסון, פלאפל (כדור), חביתה.
  - **unit:"slice"** (פרוסה) — לחם, פרוסת גבינה צהובה, פרוסת עוגה, פרוסת אבטיח/אננס.
  - **unit:"portion"** (מנה) — פסטה, אורז, קינואה, מרק, שקשוקה, סלט, בשר/עוף/דג (חתיכה), צ׳יפס, גלידה (מנה), שייק, חביתת ירקות.
  - כפות/כפיות/חופן/כוס/קופסה/פחית — תן את היחידה האנגלית כפי שהיא (\`tbsp\`/\`tsp\`/\`handful\`/\`cup\`/\`can\`/\`drink_can\`) או בעברית (\`כף\`/\`כפית\`/\`חופן\`/\`כוס\`/\`קופסה\`/\`פחית\`) — המערכת תזהה.
• אם המשתמש כותב רק שם מאכל בלי מספר — קבע \`quantity_uncertain\` לפי כללי הכמות (ראה למטה). FIXED_SINGLE → quantity:1; VARIABLE/COUNTABLE → quantity_uncertain:true + הערכת ברירת מחדל.
• אם כתב מספר בלבד ליד שם ("בננה 2", "2 ביצים", "3 פיתות") — \`quantity\` = המספר, \`unit\` = "unit", \`quantity_uncertain\`: false.
{
  "type": "add_food",
  "data": {
    "foods": [
      { "name": "בננה", "quantity": 1, "unit": "unit", "quantity_uncertain": false,
        "kcal_per_100g": 89, "protein_per_100g": 1.1, "fat_per_100g": 0.3, "carbs_per_100g": 23 },
      { "name": "בייקון", "quantity": 3, "unit": "slice", "quantity_uncertain": true,
        "prompt_unit_singular": "פרוסה", "prompt_unit_plural": "פרוסות", "prompt_grams_per_unit": 15,
        "quantity_prompt_title": "כמה פרוסות בייקון?",
        "kcal_per_100g": 400, "protein_per_100g": 25, "fat_per_100g": 35, "carbs_per_100g": 0 }
    ]
  }
}

═══════════════════════════════════════
🧩 פירוק הודעה מורכבת - קריטי!
═══════════════════════════════════════

כשמשתמש שולח הודעה עם מספר מאכלים, פרק והכנס הכל כרשימת foods (name + quantity + unit, או grams בלבד)!

**דוגמה:**
"אכלתי לחמניה עם 2 ביצים קשות וממרח חומוס בנוסף 2 כוסות מים 8 תותים בינוניים ובננה"

**פירוק (כמות + יחידה — המרה לגרם בקוד):**
1. לחמניה (1 יחידה) → quantity: 1, unit: "unit"
2. 2 ביצים קשות → quantity: 2, unit: "unit" (ביצה)
3. ממרח חומוס (~30g) → quantity: 30, unit: "gram"
4. 2 כוסות מים → water_glasses: 2
5. 8 תותים בינוניים → quantity: 8, unit: "unit"
6. בננה (1 יחידה) → quantity: 1, unit: "unit"

**תשובת JSON לדוגמה (כולל ערכים ל-100g):**
{
  "intent": "report_food",
  "response": "(המערכת תבנה טקסט אחרי החישוב)",
  "action": {
    "type": "add_food",
    "data": {
      "foods": [
        { "name": "לחמניה", "quantity": 1, "unit": "unit",
          "kcal_per_100g": 265, "protein_per_100g": 9, "fat_per_100g": 3.2, "carbs_per_100g": 49 },
        { "name": "2 ביצים קשות", "quantity": 2, "unit": "unit",
          "kcal_per_100g": 155, "protein_per_100g": 13, "fat_per_100g": 11, "carbs_per_100g": 1.1 },
        { "name": "חומוס", "quantity": 30, "unit": "gram",
          "kcal_per_100g": 166, "protein_per_100g": 8, "fat_per_100g": 10, "carbs_per_100g": 14 },
        { "name": "8 תותים", "quantity": 8, "unit": "unit",
          "kcal_per_100g": 32, "protein_per_100g": 0.7, "fat_per_100g": 0.3, "carbs_per_100g": 7.7 },
        { "name": "בננה", "quantity": 1, "unit": "unit",
          "kcal_per_100g": 89, "protein_per_100g": 1.1, "fat_per_100g": 0.3, "carbs_per_100g": 23 }
      ],
      "water_glasses": 2
    }
  }
}

⚠️ כללים לפירוק:
• "עם" / "בנוסף" / "ו-" / "גם" = מאכלים נפרדים
• מספר + יחידה = quantity + unit (המערכת תהמיר לגרם)
• גרם מפורש → quantity + unit "gram"
• בננה = לרוב 1 unit; ביצה = unit לפי מספר
• לחמניה = unit אחת
• אם כתוב "200 גרם אורז" אפשר { "name": "אורז", "grams": 200, "kcal_per_100g": 130, ... }
• **חובה** kcal_per_100g + protein/fat/carbs_per_100g לכל מאכל ב-foods
• אם יש מים - הוסף water_glasses

💧 **add_water** - כשמדווח על מים
{
  "type": "add_water", 
  "data": { "glasses": 1 }
}

❓ **ask_quantity** — לרוב **לא** להשתמש. הצ'אט רושם ישירות למאזן ותחת ההודעה יש כפתור עריכה ירוק קטן שמוביל למסך "ארוחות" לעריכת הכמות.

${buildQuantityPromptRulesBlock()}

⛔ **לעולם לא ask_quantity** אם:
────────────────────────────────────────
• כל ספרה במסר (כולל "200 גרם", "יוגורט 3%", "2 פרוסות", "חצי צלחת").
• גרם, מ"ל, ליטר, קילו, ק״ג, משקל.
• חופן, כף/כפות/כפית, פרוסה/פרוסות, מנה/מנות, כוס/כוסות מזון, צלחת, קערה, גביע, קופסה, פחית, בקבוק, פיתה.
• "סטנדרט", "סטנדרטי/ת/יות", "בינוני/ת", "גדול/ה", "קטן/ה" כשמתארים כמות.
• מילות מספר בעברית: שתי/שני/שלוש/… ביחיד עם המאכל.
• "קצת", "מעט", "חצי", "רבע", "שליש" לצד מאכל.

ה־ask_quantity נשמר רק עבור הודעות ערפיליות לחלוטין (למשל "אכלתי משהו") — בלי שם מאכל ספציפי. גם אז עדיף לבקש בקצרה במשפט response רגיל ולא להחזיר action מיוחד.

🔄 **show_alternatives** - כשמציג חליפות (הערך עצמך — אותו מאזן קלורי)
{
  "type": "show_alternatives",
  "data": {
    "original": "חטיף חלבון",
    "original_nutrition": { "calories": 200, "protein": 20, "fat": 8 },
    "alternatives": [
      { "name": "200g קוטג' 5%", "calories": 200, "protein": 22, "fat": 10 },
      { "name": "121g חזה עוף", "calories": 200, "protein": 37, "fat": 4 }
    ]
  }
}

═══════════════════════════════════════
🔬 חליפות — אותו מאזן קלורי
═══════════════════════════════════════

כשמבקשים חליפה — חשב כמות שווה-קלורית לפי הערכים שלך:
כמות_חליפה = (קלוריות_מקורי ÷ קלוריות_חליפה_ל100g) × 100

דוגמה: 200g פסטה (131 קל/100g) = 262 קל → אורז 202g או קינואה 218g לאותו מאזן.

═══════════════════════════════════════
⚠️ כללים קריטיים - יציבות!
═══════════════════════════════════════

🎯 **כלל הזהב: תשובה אחת בלבד!**
────────────────────────────────────────
• לא לשלוח 2-3 הודעות
• לא לחזור על אותו תוכן
• הכל בתשובה אחת מסודרת

📋 **פורמט לדיווח אוכל - קצר וממוקד!**
────────────────────────────────────────
כשמשתמש מדווח "אכלתי X" עם כמות - תגיב כך:

"✅ נרשם: [שם]
📊 [כמות] | [קלוריות] קל | [חלבון]g | [שומן]g
📈 מאזן: [צרכת]/[יעד] קל
💪 [מילה אחת חיובית]!"

**דוגמאות:**
"✅ נרשם: פסטה
📊 200g | 262 קל | 10g חלבון | 2g שומן
📈 מאזן: 750/2000 קל
💪 מעולה!"

"✅ נרשם: תמנון
📊 150g | 123 קל | 23g חלבון | 1g שומן
📈 מאזן: 1500/2000 קל
💪 חלבון איכותי!"

**באמת אין שום רמז כמות בהודעה?** קבע quantity_uncertain לפי הקטגוריה — לא ניחוש גרם אוטומטי לכל מאכל.

🚨 **חשוב!**
- הודעה אחת בלבד!
- לא להוסיף המלצות מיותרות
- לא לשפוט על השעה
- לא להגיד "מאוחר" או "כבדה"

🥖 **ברכת המזון אחרי לחם**
────────────────────────────────────────
כשמדווחים לחם (או מאפה דומה) בכמות שעולה ככל הנראה על כזית, **האפליקציה מוסיפה אוטומטית** בתשובת הרישום משפט קצר על ברכת המזון (כולל הפניה למסך ״ברכת המזון״ בתפריט). **אין צורך** לשכפל את הנושא ב־response של ה־JSON — הוא יידרס בעת בניית התצוגה.

📋 **פורמט לחליפות:**
────────────────────────────────────────
"🔄 חלופות ל-[מזון מקורי]:
────────────────────
1️⃣ [שם חליפה] ([כמות])
   [קלוריות] קל | [חלבון]g חלבון | [שומן]g שומן

2️⃣ [שם חליפה] ([כמות])
   [קלוריות] קל | [חלבון]g חלבון | [שומן]g שומן

💡 כולם שווי ערך קלורי!"

📋 **כמות חסרה:**
────────────────────────────────────────
השתמש ב-\`quantity_uncertain\` לפי כללי הכמות למעלה. FIXED_SINGLE → רישום ישיר; VARIABLE/COUNTABLE → quantity_uncertain:true + כרטיסייה בלקוח. רק הודעה ערפילית לגמרי (בלי שם מאכל) — שאל בקצרה ב־response.

📋 **כללי יציבות:**
────────────────────────────────────────
1. **JSON תקין תמיד** - לא טקסט חופשי
2. **תשובה אחת** - לא לחזור, לא לכפול
3. **פורמט קבוע** - השתמש ב-| כמפריד
4. **ערכים ריאליים** - הערך תזונה סביר לכל מאכל (kcal_per_100g וכו')
5. **סיכום תרומה** - תמיד תראה כמה הארוחה תרמה למאזן
6. **קצר וברור** - לא לדבר הרבה, ישר לעניין

🧠 **היה ער למאזן - תמיד!**
────────────────────────────────────────
בכל תשובה, תסתכל על:
• כמה קלוריות נשארו? (אם מעט - תציע משהו קל)
• כמה חלבון חסר? (אם הרבה - תמליץ על מקור חלבון)
• מה השעה? (תתאים את ההמלצה לזמן ביום)

**המלצות לפי מצב המאזן:**
• נשארו 1500+ קל → ארוחה מלאה (עוף+אורז, פסטה עם בשר)
• נשארו 800-1500 קל → ארוחה בינונית (סלט עם חלבון, פיתה עם חומוס)
• נשארו 300-800 קל → נשנוש (יוגורט, פרי, חופן אגוזים)
• נשארו פחות מ-300 קל → משהו קל מאוד (ירקות, מים, תה)

**כללי התנהגות חשובים:**
────────────────────────────────────────
1. **אל תשפוט!** - בן אדם יכול לאכול בכל שעה שהוא רוצה
2. **אל תלחץ!** - לא צריך להזכיר כל פעם "מאוחר", "כבדה", וכו'
3. **היה תומך!** - "מעולה", "יופי", "בחירה טובה"
4. **הודעה אחת בלבד!** - לא 2-3 הודעות, הכל בתשובה אחת

**דוגמה לתשובה טובה (21:30):**
"✅ נרשם: תמנון
────────────────────
📊 150 גרם | 123 קל | 23g חלבון | 1g שומן
📈 מאזן: 1500/2000 קל
💪 מקור חלבון מעולה!"

**דוגמה לתשובה רעה (לא לעשות!):**
"נרשם... אבל השעה מאוחרת... כדאי לשתות מים... מחר נתחיל מחדש..."
זה לחץ מיותר!`;
};

// ============================================================
// FORMAT CONVERSATION HISTORY
// ============================================================
const formatConversationHistory = (history) => {
  return history.slice(-6).map(msg => ({
    role: msg.isBot ? 'assistant' : 'user',
    content: msg.text || ''
  })).filter(msg => msg.content.trim());
};

// ============================================================
// PARSE SMART RESPONSE
// ============================================================
const PARSE_FAIL_RESPONSE = {
  intent: INTENTS.GENERAL_CHAT,
  response: 'לא הצלחתי לעבד את ההודעה. אפשר לכתוב שוב?',
  action: null,
};

function guardPartialLoggedReply(result) {
  const text = String(result?.response ?? '').trim();
  if (!result?.action && /^נרשם/.test(text)) {
    devLog('⚠️ Blocked partial "נרשם" without action');
    return PARSE_FAIL_RESPONSE;
  }
  return result;
}

const parseSmartResponse = (response, context) => {
  devLog('Raw Gemini response:', response?.substring(0, 300));
  
  if (!response || typeof response !== 'string') {
    return {
      intent: INTENTS.GENERAL_CHAT,
      response: 'איך אפשר לעזור? 🙂',
      action: null,
    };
  }
  
  try {
    // Step 1: Remove Gemini's "thinking" / chain of thought
    let cleanResponse = response
      // Remove thinking markers
      .replace(/\*\s*Okay[\s\S]*?\*Wait\*/gi, '')
      .replace(/\*\s*Let me[\s\S]*?\*/gi, '')
      .replace(/\*\s*I need[\s\S]*?\*/gi, '')
      .replace(/\*\s*The user[\s\S]*?\*/gi, '')
      .replace(/Okay,\s*the user[\s\S]*?quantity\./gi, '')
      .replace(/I need the quantity[\s\S]*?\./gi, '')
      .replace(/\*Wait\*,?/gi, '')
      // Remove markdown code blocks
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      // Remove English thinking text
      .replace(/Okay,[\s\S]*?(?=\{|$)/gi, '')
      .replace(/Let me[\s\S]*?(?=\{|$)/gi, '')
      .trim();

    devLog('Cleaned response:', cleanResponse?.substring(0, 200));

    // Method 1: Try to JSON.parse the first {...} block, escaping
    // raw control characters inside string values as a last resort
    // if the upstream JSON contains them (some models do).
    try {
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const rawJson = jsonMatch[0];
        let parsed;
        try {
          parsed = JSON.parse(rawJson);
        } catch (e1) {
          // Fallback: escape raw newlines/tabs that appeared inside
          // string values (the only common reason parse fails).
          const escaped = rawJson
            .replace(/(?<!\\)\n/g, '\\n')
            .replace(/(?<!\\)\r/g, '\\r')
            .replace(/(?<!\\)\t/g, '\\t');
          parsed = JSON.parse(escaped);
        }
        const parsedHasPayload =
          parsed &&
          (Object.prototype.hasOwnProperty.call(parsed, 'response') ||
            parsed.action ||
            parsed.intent);

        if (parsedHasPayload) {
          // Clean the response from any remaining English text
          let finalResponse =
            typeof parsed.response === 'string'
              ? parsed.response
                  .replace(/\\n/g, '\n')
                  .replace(/Okay[\s\S]*?quantity\.?/gi, '')
                  .replace(/\*Wait\*/gi, '')
                  .trim()
              : '';

          // If no action but intent is report_food, try to build action from response
          let action = parsed.action;
          if (!action && parsed.intent === 'report_food') {
            action = tryBuildFoodAction(rawJson, finalResponse);
          }

          devLog('✅ Parsed JSON, action:', action?.type || 'none');
          return guardPartialLoggedReply({
            intent: parsed.intent || INTENTS.GENERAL_CHAT,
            response: finalResponse,
            action: action,
          });
        }
      }
    } catch (e) {
      devLog('Direct JSON failed:', e.message);
    }

    // Method 2: Extract response between quotes manually
    // This handles cases where JSON is malformed
    const responseStartMatch = cleanResponse.match(/"response"\s*:\s*"/);
    if (responseStartMatch) {
      const startIdx = responseStartMatch.index + responseStartMatch[0].length;
      let endIdx = startIdx;
      let escaped = false;
      
      // Find the closing quote (handle escaped quotes)
      for (let i = startIdx; i < cleanResponse.length; i++) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (cleanResponse[i] === '\\') {
          escaped = true;
          continue;
        }
        if (cleanResponse[i] === '"') {
          endIdx = i;
          break;
        }
      }
      
      if (endIdx > startIdx) {
        const extractedResponse = cleanResponse.substring(startIdx, endIdx)
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
        
        // Get intent
        const intentMatch = cleanResponse.match(/"intent"\s*:\s*"([^"]+)"/);
        
        // Try to extract action object
        let extractedAction = null;
        const actionMatch = cleanResponse.match(/"action"\s*:\s*(\{[\s\S]*?\})\s*[,}]/);
        if (actionMatch) {
          try {
            extractedAction = JSON.parse(actionMatch[1]);
            devLog('✅ Extracted action:', extractedAction?.type);
          } catch (e) {
            devLog('Action parse failed, trying alternative');
          }
        }
        
        // If no action found but intent is report_food, try to build action from context
        const intent = intentMatch ? intentMatch[1] : INTENTS.GENERAL_CHAT;
        if (!extractedAction && intent === 'report_food') {
          // Try to extract food data from the response or build default action
          extractedAction = tryBuildFoodAction(cleanResponse, extractedResponse);
        }
        
        devLog('✅ Extracted via manual parsing:', extractedResponse.substring(0, 50));
        return guardPartialLoggedReply({
          intent: intent,
          response: extractedResponse,
          action: extractedAction,
        });
      }
    }

    // Method 3: If response looks like plain text (no JSON), use it directly
    if (!cleanResponse.includes('"intent"') && !cleanResponse.startsWith('{')) {
      devLog('✅ Using as plain text');
      return guardPartialLoggedReply({
        intent: INTENTS.GENERAL_CHAT,
        response: cleanResponse.substring(0, 500),
        action: null,
      });
    }

    throw new Error('Could not parse response');
  } catch (error) {
    console.error('❌ Parse error:', error.message);
    console.error('Original response:', response?.substring(0, 300));
    
    // Emergency fallback - never show raw JSON
    return {
      intent: INTENTS.GENERAL_CHAT,
      response: 'איך אפשר לעזור? 🙂',
      action: null,
    };
  }
};

// ============================================================
// HELPER: Try to build food action from response text
// ============================================================
const tryBuildFoodAction = (jsonText, responseText) => {
  try {
    // Try to find food data in the JSON
    const foodsMatch = jsonText.match(/"foods"\s*:\s*\[([\s\S]*?)\]/);
    if (foodsMatch) {
      try {
        const foodsArray = JSON.parse(`[${foodsMatch[1]}]`);
        if (foodsArray.length > 0) {
          return {
            type: 'add_food',
            data: { foods: foodsArray }
          };
        }
      } catch (e) {
        devLog('Foods array parse failed');
      }
    }
    
    // Try to extract nutrition values from response text
    const caloriesMatch = responseText.match(/(\d+)\s*קל/);
    const proteinMatch = responseText.match(/(\d+(?:\.\d+)?)\s*g?\s*חלבון/);
    const fatMatch = responseText.match(/(\d+(?:\.\d+)?)\s*g?\s*שומן/);
    const gramsMatch = responseText.match(/(\d+)\s*גרם/);
    
    // Extract food name from "נרשם: X" pattern
    const foodNameMatch = responseText.match(/נרשם:\s*([^\n|]+)/);
    
    if (caloriesMatch && foodNameMatch) {
      const food = {
        name: foodNameMatch[1].trim(),
        grams: gramsMatch ? parseInt(gramsMatch[1]) : 100,
        calories: parseInt(caloriesMatch[1]),
        protein: proteinMatch ? parseFloat(proteinMatch[1]) : 0,
        fat: fatMatch ? parseFloat(fatMatch[1]) : 0,
      };
      
      devLog('✅ Built food action from response:', food.name, food.calories);
      return {
        type: 'add_food',
        data: { foods: [food] }
      };
    }
    
    return null;
  } catch (e) {
    devLog('tryBuildFoodAction error:', e.message);
    return null;
  }
};

// ============================================================
// HELPER: Get Time of Day
// ============================================================
const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
};

// ============================================================
// HELPER: Get Greeting
// ============================================================
export const getGreeting = (userName = '') => {
  const timeOfDay = getTimeOfDay();
  const name = userName ? ` ${userName}` : '';
  
  const greetings = {
    morning: [`בוקר טוב${name}! ☀️`, `היי${name}, בוקר מקסים! 🌅`],
    afternoon: [`צהריים טובים${name}! 🌤️`, `היי${name}! איך היום? ☀️`],
    evening: [`ערב טוב${name}! 🌙`, `היי${name}, מה נשמע? ✨`],
  };

  const options = greetings[timeOfDay];
  return options[Math.floor(Math.random() * options.length)];
};

// ============================================================
// HELPER: Get Follow-up Message
// ============================================================
export const getSmartFollowUp = (stats, targets) => {
  const caloriesLeft = (targets.calories || 2000) - (stats.calories || 0);
  const proteinLeft = (targets.protein || 100) - (stats.protein || 0);
  const waterLeft = (targets.water || 8) - (stats.water_glasses || 0);

  const messages = [];

  if (caloriesLeft > 1500) {
    messages.push(`📊 נותרו ${caloriesLeft} קלוריות להיום.`);
  } else if (caloriesLeft > 500) {
    messages.push(`📊 יפה! נותרו ${caloriesLeft} קלוריות.`);
  } else if (caloriesLeft > 0) {
    messages.push(`🎯 מעולה! רק ${caloriesLeft} קלוריות נשארו!`);
  }

  if (waterLeft > 4) {
    messages.push(`💧 אל תשכח לשתות - נותרו ${waterLeft} כוסות.`);
  }

  if (proteinLeft > 50) {
    messages.push(`💪 שים לב לחלבון - נותרו ${Math.round(proteinLeft)}g.`);
  }

  return messages[Math.floor(Math.random() * messages.length)] || '';
};

