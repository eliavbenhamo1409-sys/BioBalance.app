// ============================================================
// Supabase Edge Function: delete-account
// ============================================================
// Permanently deletes the calling user's account and all data
// associated with them. Required for Apple App Store
// Guideline 5.1.1(v) — apps that support account creation must
// also offer in-app account deletion.
//
// Flow:
//   1. Verify the JWT and resolve the calling user.
//   2. Use the service-role key to remove every Storage object
//      under `images/<userId>/` (Storage is NOT cascaded by
//      auth.users deletion).
//   3. Call auth.admin.deleteUser(userId), which cascades the
//      user's rows in user_profiles, daily_stats, meals,
//      chat_messages, saved_recipes, api_usage (all FKs use
//      ON DELETE CASCADE).
//
// Deploy:
//   supabase functions deploy delete-account
//   (verify_jwt should stay ON — only the user themselves can
//    trigger their own deletion.)
//
// Required secrets (already configured for the project):
//   SUPABASE_URL
//   SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STORAGE_BUCKET = Deno.env.get("USER_STORAGE_BUCKET") ?? "images";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Recursively list every object inside `prefix` and return the full paths.
async function listAllObjects(
  service: ReturnType<typeof createClient>,
  prefix: string,
): Promise<string[]> {
  const collected: string[] = [];
  const queue: string[] = [prefix];

  while (queue.length > 0) {
    const current = queue.shift()!;
    let offset = 0;
    const pageSize = 100;

    while (true) {
      const { data, error } = await service.storage
        .from(STORAGE_BUCKET)
        .list(current, { limit: pageSize, offset });

      if (error) {
        console.error("[delete-account] storage list error:", error);
        break;
      }
      if (!data || data.length === 0) break;

      for (const entry of data) {
        // A Storage "folder" is a row whose `id` is null.
        const isFolder = entry.id === null;
        const fullPath = current ? `${current}/${entry.name}` : entry.name;
        if (isFolder) {
          queue.push(fullPath);
        } else {
          collected.push(fullPath);
        }
      }

      if (data.length < pageSize) break;
      offset += pageSize;
    }
  }

  return collected;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(
      { error: "Supabase runtime env not configured" },
      500,
    );
  }

  // 1) Authenticate caller using their JWT.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Missing Authorization bearer token" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    console.error("[delete-account] auth.getUser failed:", userError);
    return jsonResponse({ error: "unauthenticated" }, 401);
  }
  const userId = userData.user.id;

  // 2) Service-role client for privileged operations.
  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 3) Wipe Storage prefix for this user. Storage is NOT cascaded by
  //    deleting the auth row, so we must clean it explicitly.
  let removedFiles = 0;
  try {
    const paths = await listAllObjects(service, userId);
    if (paths.length > 0) {
      // remove() takes up to 1000 paths per call. Chunk just in case.
      for (let i = 0; i < paths.length; i += 500) {
        const chunk = paths.slice(i, i + 500);
        const { error: rmError } = await service.storage
          .from(STORAGE_BUCKET)
          .remove(chunk);
        if (rmError) {
          console.error("[delete-account] storage remove error:", rmError);
        } else {
          removedFiles += chunk.length;
        }
      }
    }
  } catch (err) {
    // Don't block account deletion on Storage cleanup failure — log only.
    console.error("[delete-account] storage cleanup threw:", err);
  }

  // 4) Delete the auth.users row. CASCADE handles user_profiles,
  //    daily_stats, meals, chat_messages, saved_recipes, api_usage.
  const { error: deleteError } = await service.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error("[delete-account] admin.deleteUser failed:", deleteError);
    return jsonResponse(
      { error: "delete_failed", message: deleteError.message },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    user_id: userId,
    removed_files: removedFiles,
  });
});
