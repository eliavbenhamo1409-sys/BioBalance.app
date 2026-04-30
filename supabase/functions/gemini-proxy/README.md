# gemini-proxy (Supabase Edge Function)

Proxy ל-Gemini API של Google. משאיר את מפתח Gemini בצד השרת ומחזיר תגובות JSON מובנות (`ok`, `errorKind`, `requestId`, `retryable`, …).

## פרויקט ופריסה

- פרויקט: **biobalance** — `xnynrlctilanhcexkfse`
- Endpoint: `https://xnynrlctilanhcexkfse.supabase.co/functions/v1/gemini-proxy`
- **סודות חובה ב-Dashboard → Edge Functions → gemini-proxy → Secrets**
  - `GEMINI_API_KEY` — מפתח Google AI (Gemini)
  - `SUPABASE_SERVICE_ROLE_KEY` — נדרש ל-RPC ניהוליים (`gemini_*_admin`) ולטבלאות מנהל
  - אופציונלי: `GEMINI_API_KEY_FALLBACK`, `DAILY_MESSAGE_LIMIT`
- **מיגרציות DB** (טבלאות `ai_runtime_config`, `ai_requests`, RPC `gemini_preflight_admin` וכו’) יושמו על הפרויקט דרך Cursor/MCP.

### תוכן גוף מהאפליקציה

בנוסף לשדות Gemini (`model`, `contents`, …) חובה:

- `messageId` — UUID (מפתח אידempotנטיות להודעת משתמש)
- `requestId` — UUID למסלול לוגים

כותרות מומלצות מהאפליקציה: `x-app-version`, `x-app-build`, `x-request-id`.

### Kill switch

טבלה `public.ai_runtime_config` (`ai_chat_enabled`). כש־`false`, הפונקציה מחזירה `errorKind: "disabled"` בלי לקרוא ל-Gemini.

### מכסות

מכסת **הצלחות** יומית נספרת רק אחרי תשובת Gemini מוצלחת (דרך `gemini_commit_success_admin`). יש גם חלון ניסיונות/anti-abuse ב-RPC `gemini_preflight_admin`.

## פריסה מחדש

### דרך MCP (Cursor)

בקש מהסוכן לפרוס את `supabase/functions/gemini-proxy/index.ts` לפרויקט `xnynrlctilanhcexkfse`.

### דרך CLI

```bash
supabase login
supabase link --project-ref xnynrlctilanhcexkfse
supabase functions deploy gemini-proxy
```

### דרך Management API (Personal Access Token)

```bash
curl --request POST \
  --url 'https://api.supabase.com/v1/projects/xnynrlctilanhcexkfse/functions/deploy?slug=gemini-proxy' \
  --header "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  --header 'Content-Type: multipart/form-data' \
  --form 'metadata={"entrypoint_path":"index.ts","name":"gemini-proxy"}' \
  --form "file=@supabase/functions/gemini-proxy/index.ts"
```

(`SUPABASE_ACCESS_TOKEN` מתחיל בדרך כלל ב־`sbp_`.)

## בדיקה מהירה

דורש JWT של משתמש מחובר + שני UUID תקינים בגוף:

```bash
curl -i -X POST \
  "https://xnynrlctilanhcexkfse.supabase.co/functions/v1/gemini-proxy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "x-app-version: 1.0.0" \
  -H "x-app-build: 1" \
  -d '{
    "messageId": "550e8400-e29b-41d4-a716-446655440000",
    "requestId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "model": "gemini-2.5-flash",
    "contents": [{"role":"user","parts":[{"text":"היי קצר"}]}]
  }'
```

## האפליקציה

הקליינט קורא דרך `src/api/geminiClient.js` → `supabase.functions.invoke('gemini-proxy', …)` עם מעטפת הודעה (`messageId` / `requestId`) ופרסור תגובת `ok`/`gemini`.
