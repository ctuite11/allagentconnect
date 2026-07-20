/**
 * Communications Center digest timing helpers.
 *
 * Mutually exclusive delivery:
 *   immediate → email_jobs now
 *   daily/weekly → comms_digest_items only (no per-activity email_jobs)
 */

import { AAC_PUBLIC_URL } from "./aacPublicUrl.ts";

export type CommsSchedule = "immediate" | "daily" | "weekly";
export type DigestCadence = "daily" | "weekly";
export type DigestSourceType = "client_need" | "broadcast";

export type DigestItemInsert = {
  agent_id: string;
  cadence: DigestCadence;
  source_type: DigestSourceType;
  source_id: string;
  category: string | null;
  title: string;
  summary: Record<string, unknown>;
  item_html: string;
  action_url?: string | null;
};

type SupabaseLike = {
  from: (table: string) => any;
};

const DEFAULT_ACTION_URL = `${AAC_PUBLIC_URL}/communications/feed`;

/** Normalize DB / missing values to a safe schedule. */
export function normalizeCommsSchedule(raw: unknown): CommsSchedule {
  if (raw === "daily" || raw === "weekly" || raw === "immediate") return raw;
  return "immediate";
}

/**
 * Load client_needs_schedule (+ enabled flag) for many agents.
 * Missing prefs → immediate (legacy default).
 * client_needs_enabled === false → omitted from map as "muted" (caller skips).
 */
export async function loadCommsSchedules(
  supabase: SupabaseLike,
  agentIds: string[],
): Promise<{
  schedules: Map<string, CommsSchedule>;
  muted: Set<string>;
}> {
  const schedules = new Map<string, CommsSchedule>();
  const muted = new Set<string>();
  const ids = Array.from(new Set(agentIds.filter(Boolean)));
  if (ids.length === 0) return { schedules, muted };

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("user_id, client_needs_schedule, client_needs_enabled, new_matches_enabled")
    .in("user_id", ids);

  if (error) {
    console.warn("[loadCommsSchedules] lookup failed; defaulting all to immediate", error);
    for (const id of ids) schedules.set(id, "immediate");
    return { schedules, muted };
  }

  const found = new Set<string>();
  for (const row of data || []) {
    const uid = row.user_id as string;
    found.add(uid);
    // Honor prior "Off" (UI no longer offers it): mute both paths.
    if (row.client_needs_enabled === false || row.new_matches_enabled === false) {
      muted.add(uid);
      continue;
    }
    schedules.set(uid, normalizeCommsSchedule(row.client_needs_schedule));
  }
  for (const id of ids) {
    if (!found.has(id) && !muted.has(id)) schedules.set(id, "immediate");
  }
  return { schedules, muted };
}

export function partitionByCommsSchedule<T extends { agent_id: string }>(
  agents: T[],
  schedules: Map<string, CommsSchedule>,
  muted: Set<string>,
): {
  immediate: T[];
  digest: Array<T & { cadence: DigestCadence }>;
  skippedMuted: number;
} {
  const immediate: T[] = [];
  const digest: Array<T & { cadence: DigestCadence }> = [];
  let skippedMuted = 0;

  for (const a of agents) {
    if (muted.has(a.agent_id)) {
      skippedMuted++;
      continue;
    }
    const schedule = schedules.get(a.agent_id) ?? "immediate";
    if (schedule === "daily" || schedule === "weekly") {
      digest.push({ ...a, cadence: schedule });
    } else {
      immediate.push(a);
    }
  }
  return { immediate, digest, skippedMuted };
}

/** Insert digest items; unique conflicts are treated as success (idempotent). */
export async function insertDigestItems(
  supabase: SupabaseLike,
  items: DigestItemInsert[],
): Promise<{ inserted: number; conflicted: number }> {
  if (items.length === 0) return { inserted: 0, conflicted: 0 };

  const rows = items.map((item) => ({
    agent_id: item.agent_id,
    cadence: item.cadence,
    source_type: item.source_type,
    source_id: item.source_id,
    category: item.category,
    title: item.title,
    summary: item.summary,
    item_html: item.item_html,
    action_url: item.action_url ?? DEFAULT_ACTION_URL,
  }));

  const { data, error } = await supabase
    .from("comms_digest_items")
    .upsert(rows, {
      onConflict: "agent_id,source_type,source_id",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) throw error;
  const inserted = (data || []).length;
  return { inserted, conflicted: Math.max(0, rows.length - inserted) };
}

export function defaultCommsActionUrl(): string {
  return DEFAULT_ACTION_URL;
}

/* ------------------------------------------------------------------ */
/*  Eastern period helpers (no per-agent TZ yet)                       */
/* ------------------------------------------------------------------ */

const ET = "America/New_York";

function etParts(now: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  weekday: string; // short: Mon, Tue, ... Fri
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  let hour = Number(get("hour"));
  // Some engines emit "24" for midnight
  if (hour === 24) hour = 0;

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    weekday: get("weekday"),
  };
}

/** ISO-like week key in Eastern: weekly:YYYY-Www */
export function easternWeeklyPeriodKey(now: Date = new Date()): string {
  const { year, month, day } = etParts(now);
  // Use UTC noon of the ET calendar date to compute ISO week stably.
  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const iso = isoWeekYearAndWeek(utcNoon);
  return `weekly:${iso.year}-W${String(iso.week).padStart(2, "0")}`;
}

export function easternDailyPeriodKey(now: Date = new Date()): string {
  const { year, month, day } = etParts(now);
  return `daily:${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isoWeekYearAndWeek(d: Date): { year: number; week: number } {
  // ISO week date algorithm on the UTC calendar of `d`.
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

/**
 * Whether digests may be processed now (catch-up from 18:00 ET through end of ET day).
 * Daily: every day after 18:00 ET.
 * Weekly: Fridays after 18:00 ET.
 */
export function digestWindowsOpen(now: Date = new Date()): {
  daily: boolean;
  weekly: boolean;
  dailyPeriodKey: string;
  weeklyPeriodKey: string;
  etHour: number;
  etWeekday: string;
} {
  const p = etParts(now);
  const afterSix = p.hour >= 18;
  return {
    daily: afterSix,
    weekly: afterSix && p.weekday === "Fri",
    dailyPeriodKey: easternDailyPeriodKey(now),
    weeklyPeriodKey: easternWeeklyPeriodKey(now),
    etHour: p.hour,
    etWeekday: p.weekday,
  };
}
