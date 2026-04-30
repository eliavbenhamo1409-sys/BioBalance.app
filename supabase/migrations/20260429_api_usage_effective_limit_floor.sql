-- Enforce a minimum daily API quota of 60 in Postgres, so even an old
-- gemini-proxy (or DAILY_MESSAGE_LIMIT=10 in Edge secrets) cannot cap users below 60.
-- Also unblocks accounts that already exceeded 10 but are still under 60 calls.

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
  v_effective_limit integer;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_effective_limit := GREATEST(COALESCE(p_limit, 60), 60);

  INSERT INTO public.api_usage (user_id, date, count, last_request_at)
  VALUES (v_user, v_today, 1, now())
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    count = public.api_usage.count + 1,
    last_request_at = now()
  RETURNING count INTO v_count;

  RETURN QUERY SELECT v_count, (v_count <= v_effective_limit), v_effective_limit;
END;
$$;
