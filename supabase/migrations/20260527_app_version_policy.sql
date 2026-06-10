-- Minimum app versions enforced client-side (ForceUpdateScreen).
-- After deploying a new store build, set min_*_version here (no app rebuild needed).
--
-- Example: force everyone below 1.0.6 to update:
--   UPDATE public.app_version_policy
--   SET min_ios_version = '1.0.6', min_android_version = '1.0.6', updated_at = now()
--   WHERE id = 'default';

CREATE TABLE IF NOT EXISTS public.app_version_policy (
  id text PRIMARY KEY,
  min_ios_version text NOT NULL,
  min_android_version text NOT NULL,
  ios_store_url text NOT NULL,
  android_store_url text NOT NULL,
  message_he text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_version_policy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_version_policy_select_public" ON public.app_version_policy;
CREATE POLICY "app_version_policy_select_public"
  ON public.app_version_policy
  FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO public.app_version_policy (
  id,
  min_ios_version,
  min_android_version,
  ios_store_url,
  android_store_url,
  message_he
)
VALUES (
  'default',
  '1.0.6',
  '1.0.6',
  'https://apps.apple.com/app/id6756488694',
  'https://play.google.com/store/apps/details?id=com.naturebot.app',
  'גרסה חדשה של BioBalance זמינה. יש לעדכן את האפליקציה כדי להמשיך להשתמש.'
)
ON CONFLICT (id) DO NOTHING;
