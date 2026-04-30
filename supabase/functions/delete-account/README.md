# delete-account Edge Function

Permanently deletes the calling user's account and all data associated with
them. Required for Apple App Store **Guideline 5.1.1(v)** — apps that support
account creation must also offer in-app account deletion.

## What it deletes

1. **Storage:** every object under `images/<userId>/` (recursively).
2. **Auth user:** `auth.users` row for the caller, via Admin API.
3. **All app tables (via `ON DELETE CASCADE`):**
   - `user_profiles`
   - `daily_stats`
   - `meals`
   - `chat_messages`
   - `saved_recipes`
   - `api_usage`

## Auth

`verify_jwt` is enabled (default). The function uses the caller's JWT to
resolve their `userId`, so a user can only delete _their own_ account.

## Required secrets

These are typically already set in the project. If not:

```
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are auto-injected by the Supabase
runtime. Optional:

```
supabase secrets set USER_STORAGE_BUCKET=images   # default: "images"
```

## Deploy

```
supabase functions deploy delete-account
```

## Client usage

```js
const { data: { session } } = await supabase.auth.getSession();
await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    apikey: SUPABASE_ANON_KEY,
  },
});
await supabase.auth.signOut();
```
