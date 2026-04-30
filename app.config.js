// Dynamic Expo config: maps GEMINI_API_KEY → extra.geminiApiKeyForDirect so a single
// .env key can feed direct Gemini mode; passes Supabase URL/anon into extra as fallback.
const appJson = require('./app.json');

const geminiDirect =
  process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim() ||
  process.env.GEMINI_API_KEY?.trim() ||
  '';

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      geminiApiKeyForDirect: geminiDirect || undefined,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || undefined,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || undefined,
    },
  },
};
