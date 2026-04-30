-- ============================================================
-- API Usage Rate Limiting
-- ============================================================
-- Per-user, per-day counter enforced server-side by the
-- gemini-proxy Edge Function. Guards against runaway AI
-- requests (e.g. a broken client retrying forever).
--
-- Applied via Supabase MCP on 2026-04-23.
-- Kept here for version control / re-deploys.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.api_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  last_request_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_user_date
  ON public.api_usage(user_id, date DESC);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_usage_select_own" ON public.api_usage;
CREATE POLICY "api_usage_select_own"
  ON public.api_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Atomic increment RPC that enforces the limit server-side.
-- Returns the updated count + whether the limit was exceeded.
-- SECURITY DEFINER so it bypasses RLS on write, but the function
-- checks auth.uid() so callers can only touch their own row.
CREATE OR REPLACE FUNCTION public.increment_api_usage(p_limit integer)
RETURNS TABLE(new_count integer, allowed boolean, daily_limit integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_count integer;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  INSERT INTO public.api_usage (user_id, date, count, last_request_at)
  VALUES (v_user, v_today, 1, now())
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    count = public.api_usage.count + 1,
    last_request_at = now()
  RETURNING count INTO v_count;

  RETURN QUERY SELECT v_count, (v_count <= p_limit), p_limit;
END;
$$;

-- Read-only helper so the client can show "X left today" without
-- incrementing the counter.
CREATE OR REPLACE FUNCTION public.get_api_usage_today()
RETURNS TABLE(used integer, request_date date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  RETURN QUERY
    SELECT COALESCE(au.count, 0)::integer AS used, v_today AS request_date
    FROM (SELECT 1) s
    LEFT JOIN public.api_usage au
      ON au.user_id = v_user AND au.date = v_today;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_api_usage(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_api_usage(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_api_usage_today() TO authenticated, service_role;
