-- ============================================================
-- AI Gemini production: kill switch, ai_requests cache,
-- success-only daily quota, abuse window for attempts.
-- Privileged RPCs are service_role only (called from Edge after JWT verify).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_runtime_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ai_chat_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ai_runtime_config (id, ai_chat_enabled)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ai_runtime_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ai_requests (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL,
  request_id uuid,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed')),
  gemini_response jsonb,
  error_kind text,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_requests_user_updated
  ON public.ai_requests(user_id, updated_at DESC);

ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_requests_select_own" ON public.ai_requests;
CREATE POLICY "ai_requests_select_own"
  ON public.ai_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.ai_usage_commits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL,
  committed_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_commits_user_date
  ON public.ai_usage_commits(user_id, committed_date);

ALTER TABLE public.ai_usage_commits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_commits_select_own" ON public.ai_usage_commits;
CREATE POLICY "ai_usage_commits_select_own"
  ON public.ai_usage_commits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.ai_abuse_window (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL DEFAULT date_trunc('minute', now()),
  attempt_count int NOT NULL DEFAULT 0
);

ALTER TABLE public.ai_abuse_window ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_abuse_window_select_own" ON public.ai_abuse_window;
CREATE POLICY "ai_abuse_window_select_own"
  ON public.ai_abuse_window FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ---------- Edge-only RPCs (service_role): user id from verified JWT sub ----------
CREATE OR REPLACE FUNCTION public.gemini_preflight_admin(
  p_user_id uuid,
  p_message_id uuid,
  p_request_id uuid,
  p_daily_limit integer DEFAULT 60,
  p_max_attempts_per_message integer DEFAULT 12,
  p_max_attempts_per_minute integer DEFAULT 24
)
RETURNS TABLE(
  outcome text,
  gemini_response jsonb,
  daily_used integer,
  daily_limit integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ai_requests%ROWTYPE;
  v_abuse public.ai_abuse_window%ROWTYPE;
  v_win_start timestamptz := date_trunc('minute', now());
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_daily_used integer;
  v_effective_limit integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'missing_user';
  END IF;

  v_effective_limit := GREATEST(COALESCE(p_daily_limit, 60), 60);

  SELECT COALESCE(au.count, 0) INTO v_daily_used
  FROM public.api_usage au
  WHERE au.user_id = p_user_id AND au.date = v_today;
  v_daily_used := COALESCE(v_daily_used, 0);

  SELECT * INTO v_row FROM public.ai_requests r
  WHERE r.user_id = p_user_id AND r.message_id = p_message_id;

  IF FOUND AND v_row.status = 'succeeded' AND v_row.gemini_response IS NOT NULL THEN
    RETURN QUERY SELECT 'replay'::text, v_row.gemini_response, v_daily_used, v_effective_limit::integer;
    RETURN;
  END IF;

  IF v_daily_used >= v_effective_limit THEN
    RETURN QUERY SELECT 'quota_exceeded'::text, NULL::jsonb, v_daily_used, v_effective_limit::integer;
    RETURN;
  END IF;

  INSERT INTO public.ai_abuse_window AS w (user_id, window_start, attempt_count)
  VALUES (p_user_id, v_win_start, 1)
  ON CONFLICT (user_id) DO UPDATE SET
    attempt_count = CASE
      WHEN w.window_start < v_win_start THEN 1
      ELSE w.attempt_count + 1
    END,
    window_start = CASE
      WHEN w.window_start < v_win_start THEN v_win_start
      ELSE w.window_start
    END
  RETURNING * INTO v_abuse;

  IF v_abuse.attempt_count > p_max_attempts_per_minute THEN
    RETURN QUERY SELECT 'abuse'::text, NULL::jsonb, v_daily_used, v_effective_limit::integer;
    RETURN;
  END IF;

  INSERT INTO public.ai_requests (user_id, message_id, request_id, status, attempts, updated_at)
  VALUES (p_user_id, p_message_id, COALESCE(p_request_id, gen_random_uuid()), 'pending', 1, now())
  ON CONFLICT (user_id, message_id) DO UPDATE SET
    request_id = COALESCE(EXCLUDED.request_id, ai_requests.request_id),
    attempts = ai_requests.attempts + 1,
    updated_at = now()
  RETURNING * INTO v_row;

  IF v_row.attempts > p_max_attempts_per_message THEN
    RETURN QUERY SELECT 'too_many_attempts'::text, NULL::jsonb, v_daily_used, v_effective_limit::integer;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'proceed'::text, NULL::jsonb, v_daily_used, v_effective_limit::integer;
END;
$$;

CREATE OR REPLACE FUNCTION public.gemini_commit_success_admin(
  p_user_id uuid,
  p_message_id uuid,
  p_gemini_response jsonb,
  p_daily_limit integer DEFAULT 60
)
RETURNS TABLE(did_count_toward_quota boolean, new_daily_count integer, daily_limit integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_effective_limit integer := GREATEST(COALESCE(p_daily_limit, 60), 60);
  v_ins int;
  v_count integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'missing_user';
  END IF;

  UPDATE public.ai_requests SET
    status = 'succeeded',
    gemini_response = p_gemini_response,
    error_kind = NULL,
    updated_at = now()
  WHERE user_id = p_user_id AND message_id = p_message_id;

  WITH ins AS (
    INSERT INTO public.ai_usage_commits (user_id, message_id, committed_date)
    VALUES (p_user_id, p_message_id, v_today)
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*)::int FROM ins INTO v_ins;

  IF v_ins = 1 THEN
    INSERT INTO public.api_usage (user_id, date, count, last_request_at)
    VALUES (p_user_id, v_today, 1, now())
    ON CONFLICT (user_id, date)
    DO UPDATE SET
      count = public.api_usage.count + 1,
      last_request_at = now()
    RETURNING count INTO v_count;
    RETURN QUERY SELECT true, v_count, v_effective_limit::integer;
  ELSE
    SELECT COALESCE(au.count, 0) INTO v_count FROM public.api_usage au
    WHERE au.user_id = p_user_id AND au.date = v_today;
    RETURN QUERY SELECT false, COALESCE(v_count, 0), v_effective_limit::integer;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gemini_commit_failure_admin(
  p_user_id uuid,
  p_message_id uuid,
  p_error_kind text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'missing_user';
  END IF;

  UPDATE public.ai_requests SET
    status = 'failed',
    error_kind = p_error_kind,
    updated_at = now()
  WHERE user_id = p_user_id AND message_id = p_message_id AND status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.gemini_preflight_admin(uuid, uuid, uuid, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gemini_commit_success_admin(uuid, uuid, jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gemini_commit_failure_admin(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gemini_preflight_admin(uuid, uuid, uuid, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.gemini_commit_success_admin(uuid, uuid, jsonb, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.gemini_commit_failure_admin(uuid, uuid, text) TO service_role;
