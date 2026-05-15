// ============================================================
// Insights long-term memory repository
// ============================================================
// Thin DB layer on top of three Supabase tables:
//   • ai_insight_reports   — cached daily/weekly reports
//   • ai_pattern_facts     — derived long-term facts about the user
//   • ai_weekly_checkins   — user feedback on weekly check-ins
// All three are RLS-protected to auth.uid() = user_id.

import { supabase } from './supabaseClient';

const todayISO = () => new Date().toISOString().slice(0, 10);

// ---------------- ai_insight_reports ----------------

export const saveInsightReport = async (userId, report) => {
  try {
    if (!userId) return { data: null, error: new Error('userId required') };
    const {
      report_date,
      report_type = 'daily',
      overall_score = null,
      status = null,
      recommendation = null,
      main_insight = null,
      today_conclusion = null,
      strengths = [],
      improvements = [],
      action_items = [],
      personalized_tip = null,
      motivational_message = null,
      baseline = {},
      model = null,
    } = report || {};

    if (!report_date) {
      return { data: null, error: new Error('report_date required') };
    }

    const { data, error } = await supabase
      .from('ai_insight_reports')
      .upsert(
        {
          user_id: userId,
          report_date,
          report_type,
          overall_score,
          status,
          recommendation,
          main_insight,
          today_conclusion,
          strengths,
          improvements,
          action_items,
          personalized_tip,
          motivational_message,
          baseline,
          model,
        },
        { onConflict: 'user_id,report_date,report_type' },
      )
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    if (__DEV__) console.log('[insights] saveInsightReport error:', error?.message);
    return { data: null, error };
  }
};

export const getLatestInsightReport = async (userId, reportType = 'daily') => {
  try {
    if (!userId) return { data: null, error: null };
    const { data, error } = await supabase
      .from('ai_insight_reports')
      .select('*')
      .eq('user_id', userId)
      .eq('report_type', reportType)
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return { data: data || null, error: null };
  } catch (error) {
    if (__DEV__) console.log('[insights] getLatestInsightReport error:', error?.message);
    return { data: null, error };
  }
};

export const getRecentInsightReports = async (userId, limit = 6) => {
  try {
    if (!userId) return { data: [], error: null };
    const { data, error } = await supabase
      .from('ai_insight_reports')
      .select(
        'id, report_date, report_type, overall_score, main_insight, today_conclusion, recommendation, model, created_at',
      )
      .eq('user_id', userId)
      .order('report_date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    if (__DEV__) console.log('[insights] getRecentInsightReports error:', error?.message);
    return { data: [], error };
  }
};

// ---------------- ai_pattern_facts ----------------

export const upsertPatternFact = async (userId, fact) => {
  try {
    if (!userId) return { data: null, error: new Error('userId required') };
    if (!fact?.fact_key || !fact?.title) {
      return { data: null, error: new Error('fact_key and title required') };
    }
    const today = todayISO();
    const { data: existing } = await supabase
      .from('ai_pattern_facts')
      .select('id, seen_count, first_seen')
      .eq('user_id', userId)
      .eq('fact_key', fact.fact_key)
      .maybeSingle();

    const payload = {
      user_id: userId,
      fact_key: fact.fact_key,
      title: fact.title,
      description: fact.description || null,
      severity: fact.severity || 'neutral',
      confidence: typeof fact.confidence === 'number' ? fact.confidence : 0.5,
      evidence: fact.evidence || {},
      last_seen: today,
      seen_count: existing ? (existing.seen_count || 0) + 1 : 1,
      first_seen: existing?.first_seen || today,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('ai_pattern_facts')
      .upsert(payload, { onConflict: 'user_id,fact_key' })
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    if (__DEV__) console.log('[insights] upsertPatternFact error:', error?.message);
    return { data: null, error };
  }
};

export const upsertPatternFactsBulk = async (userId, facts = []) => {
  if (!userId || !Array.isArray(facts) || facts.length === 0) {
    return { ok: true };
  }
  // We loop because we need per-row read-then-upsert for `seen_count` / `first_seen`.
  // Volume is tiny (<= ~10 facts at a time).
  await Promise.all(facts.map((f) => upsertPatternFact(userId, f)));
  return { ok: true };
};

export const getPatternFacts = async (userId, limit = 20) => {
  try {
    if (!userId) return { data: [], error: null };
    const { data, error } = await supabase
      .from('ai_pattern_facts')
      .select(
        'fact_key, title, description, severity, confidence, evidence, first_seen, last_seen, seen_count',
      )
      .eq('user_id', userId)
      .order('last_seen', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    if (__DEV__) console.log('[insights] getPatternFacts error:', error?.message);
    return { data: [], error };
  }
};

// ---------------- ai_weekly_checkins ----------------

export const saveWeeklyCheckin = async (userId, payload) => {
  try {
    if (!userId) return { data: null, error: new Error('userId required') };
    const {
      week_start,
      week_end,
      report_id = null,
      reaction = null,
      feedback_text = null,
      specific_reactions = {},
    } = payload || {};

    if (!week_start || !week_end) {
      return { data: null, error: new Error('week_start and week_end required') };
    }

    const { data, error } = await supabase
      .from('ai_weekly_checkins')
      .upsert(
        {
          user_id: userId,
          week_start,
          week_end,
          report_id,
          reaction,
          feedback_text,
          specific_reactions,
        },
        { onConflict: 'user_id,week_start' },
      )
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    if (__DEV__) console.log('[insights] saveWeeklyCheckin error:', error?.message);
    return { data: null, error };
  }
};

export const getLatestWeeklyCheckin = async (userId) => {
  try {
    if (!userId) return { data: null, error: null };
    const { data, error } = await supabase
      .from('ai_weekly_checkins')
      .select('*')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return { data: data || null, error: null };
  } catch (error) {
    if (__DEV__) console.log('[insights] getLatestWeeklyCheckin error:', error?.message);
    return { data: null, error };
  }
};

export const getWeeklyCheckinsHistory = async (userId, limit = 8) => {
  try {
    if (!userId) return { data: [], error: null };
    const { data, error } = await supabase
      .from('ai_weekly_checkins')
      .select('week_start, week_end, reaction, feedback_text, specific_reactions, created_at')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    if (__DEV__) console.log('[insights] getWeeklyCheckinsHistory error:', error?.message);
    return { data: [], error };
  }
};
