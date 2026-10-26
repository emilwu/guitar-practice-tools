/**
 * Practice log: hash prefill, totals, streak, BPM series, Markdown and JSON backup.
 * The hash keys are a stable contract for the learning map. See AGENTS.md.
 * stage, week, exercise, tool, bpm. Optional: date, minutes, seconds, rating, stuck.
 */

export const STORAGE_KEY = "guitar-tools.log.v1";
export const TIMER_KEY = "guitar-tools.log.timer.v1";
export const HASH_KEYS = ["stage", "week", "exercise", "tool", "bpm", "date", "minutes", "seconds", "rating", "stuck"];
export const HASH_EXAMPLE = "stage=2&week=3&exercise=八分音符&tool=metronome&bpm=60";
export const TOOL_IDS = ["chord", "metronome", "fretboard", "other"];
export const TOOL_LABELS = {
  chord: "和弦探索器",
  metronome: "節拍器",
  fretboard: "指板訓練",
  other: "其他",
};
export const MARKDOWN_HEADER = "| 日期 | Stage/週 | 練習 | 時長 | BPM | 評分 | 卡點 |";
export const IDLE_TIMER = { status: "idle", accumulatedMs: 0, startedAt: null };

const LIMITS = { stage: 80, week: 80, exercise: 200, stuck: 2000 };

export function formatDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function validDate(value) {
  const text = String(value ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return text;
}

export function addDays(date, amount) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

/** Monday is the first day of the week. */
export function startOfWeek(date) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = day.getDay();
  const delta = weekday === 0 ? 6 : weekday - 1;
  day.setDate(day.getDate() - delta);
  return day;
}

export function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

function clip(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function optionalNumber(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function clampBpm(value) {
  const n = optionalNumber(value);
  if (n == null) return null;
  const bpm = Math.round(n);
  if (bpm < 1 || bpm > 400) return null;
  return bpm;
}

export function clampRating(value) {
  const n = optionalNumber(value);
  if (n == null || Math.round(n) !== n) return null;
  if (n < 1 || n > 5) return null;
  return n;
}

export function normalizeTool(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return "";
  return TOOL_IDS.includes(text) ? text : "other";
}

export function toolLabel(id) {
  return TOOL_LABELS[id] || "";
}

export function makeId(now = new Date()) {
  const rand = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
  return `p${now.getTime().toString(36)}-${rand}`;
}

function validInstant(value) {
  const time = Date.parse(String(value ?? ""));
  if (!Number.isFinite(time)) return "";
  return new Date(time).toISOString();
}

export function joinDuration(minutes, seconds) {
  const min = optionalNumber(minutes) ?? 0;
  const sec = optionalNumber(seconds) ?? 0;
  return Math.max(0, Math.round(min * 60 + sec));
}

export function splitDuration(totalSec) {
  const sec = Math.max(0, Math.round(Number(totalSec) || 0));
  return { minutes: Math.floor(sec / 60), seconds: sec % 60 };
}

export function formatDuration(totalSec) {
  const sec = Math.max(0, Math.round(Number(totalSec) || 0));
  if (sec === 0) return "0 分";
  if (sec < 60) return `${sec} 秒`;
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  const parts = [];
  if (hours) parts.push(`${hours} 小時`);
  if (minutes) parts.push(`${minutes} 分`);
  if (seconds) parts.push(`${seconds} 秒`);
  return parts.join(" ");
}

export function formatClock(totalMs) {
  const total = Math.max(0, Math.floor(Number(totalMs) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatStageWeek(stage, week) {
  const left = stageText(stage);
  const right = weekText(week);
  if (left && right) return `${left} / ${right}`;
  return left || right;
}

function stageText(stage) {
  const text = String(stage ?? "").trim();
  if (!text) return "";
  if (/^\d+$/.test(text)) return `Stage ${text}`;
  const named = /^stage\s+(\d+)$/i.exec(text);
  if (named) return `Stage ${named[1]}`;
  return text;
}

function weekText(week) {
  const text = String(week ?? "").trim();
  if (!text) return "";
  if (/^\d+$/.test(text)) return `第 ${text} 週`;
  return text;
}

function durationFromDraft(draft) {
  if (draft.durationSec != null && draft.durationSec !== "" && Number.isFinite(Number(draft.durationSec))) {
    return Math.max(0, Math.round(Number(draft.durationSec)));
  }
  return joinDuration(draft.minutes, draft.seconds);
}

export function createEntry(draft = {}, now = new Date()) {
  return {
    id: String(draft.id || makeId(now)),
    date: validDate(draft.date) || formatDay(now),
    durationSec: durationFromDraft(draft),
    stage: clip(draft.stage, LIMITS.stage),
    week: clip(draft.week, LIMITS.week),
    exercise: clip(draft.exercise, LIMITS.exercise),
    tool: normalizeTool(draft.tool),
    bpm: clampBpm(draft.bpm),
    rating: clampRating(draft.rating),
    stuck: clip(draft.stuck, LIMITS.stuck),
    createdAt: validInstant(draft.createdAt) || now.toISOString(),
  };
}

export function isBlankEntry(entry) {
  return (
    !entry.exercise &&
    !entry.stuck &&
    !entry.durationSec &&
    entry.bpm == null &&
    entry.rating == null &&
    !entry.stage &&
    !entry.week
  );
}

export function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (!validDate(raw.date)) return null;
  const entry = createEntry(raw);
  if (isBlankEntry(entry)) return null;
  return entry;
}

export function compareAsc(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function compareDesc(a, b) {
  return compareAsc(b, a);
}

export function parseHash(hash) {
  const raw = String(hash ?? "")
    .replace(/^#/, "")
    .trim();
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  if (![...params.keys()].some((key) => HASH_KEYS.includes(key))) return null;
  const minutes = optionalNumber(params.get("minutes"));
  const seconds = optionalNumber(params.get("seconds"));
  return {
    stage: params.get("stage")?.trim() ?? "",
    week: params.get("week")?.trim() ?? "",
    exercise: params.get("exercise")?.trim() ?? "",
    tool: params.has("tool") ? normalizeTool(params.get("tool")) : "",
    bpm: params.has("bpm") ? clampBpm(params.get("bpm")) : null,
    date: validDate(params.get("date")),
    minutes: minutes == null ? null : Math.max(0, minutes),
    seconds: seconds == null ? null : Math.max(0, seconds),
    rating: params.has("rating") ? clampRating(params.get("rating")) : null,
    stuck: params.get("stuck")?.trim() ?? "",
  };
}

export function serializeHash(draft) {
  const params = new URLSearchParams();
  if (draft.stage) params.set("stage", String(draft.stage).trim());
  if (draft.week) params.set("week", String(draft.week).trim());
  if (draft.exercise) params.set("exercise", String(draft.exercise).trim());
  if (draft.tool) params.set("tool", normalizeTool(draft.tool));
  if (clampBpm(draft.bpm)) params.set("bpm", String(clampBpm(draft.bpm)));
  if (validDate(draft.date)) params.set("date", validDate(draft.date));
  const minutes = optionalNumber(draft.minutes);
  const seconds = optionalNumber(draft.seconds);
  if (minutes) params.set("minutes", String(minutes));
  if (seconds) params.set("seconds", String(seconds));
  if (clampRating(draft.rating)) params.set("rating", String(clampRating(draft.rating)));
  if (draft.stuck) params.set("stuck", String(draft.stuck).trim());
  let hash = params.toString();
  if (hash.length > 1800 && draft.stuck) {
    params.delete("stuck");
    hash = params.toString();
  }
  return hash;
}

export function sumDuration(entries, predicate) {
  return entries.reduce((sum, entry) => (predicate(entry) ? sum + (entry.durationSec || 0) : sum), 0);
}

export function streakDays(entries, now = new Date()) {
  const days = new Set(entries.map((entry) => entry.date).filter(Boolean));
  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(formatDay(cursor))) {
    cursor = addDays(cursor, -1);
    if (!days.has(formatDay(cursor))) return 0;
  }
  let count = 0;
  while (days.has(formatDay(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function summarize(entries, now = new Date()) {
  const today = formatDay(now);
  const weekStart = formatDay(startOfWeek(now));
  const weekEnd = formatDay(endOfWeek(now));
  const inWeek = (entry) => entry.date >= weekStart && entry.date <= weekEnd;
  return {
    todaySec: sumDuration(entries, (entry) => entry.date === today),
    weekSec: sumDuration(entries, inWeek),
    streak: streakDays(entries, now),
    stuck: recentStuck(entries, 12),
    recent: [...entries].sort(compareDesc).slice(0, 40),
  };
}

export function recentStuck(entries, limit = 12) {
  return [...entries]
    .filter((entry) => entry.stuck)
    .sort(compareDesc)
    .slice(0, limit);
}

export function exerciseNames(entries) {
  const latest = new Map();
  for (const entry of entries) {
    if (!entry.exercise || entry.bpm == null) continue;
    const stamp = `${entry.date}\u0000${entry.createdAt}`;
    const prev = latest.get(entry.exercise);
    if (!prev || stamp > prev) latest.set(entry.exercise, stamp);
  }
  return [...latest.entries()].sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0)).map(([name]) => name);
}

export function bpmSeries(entries, exercise) {
  const name = String(exercise ?? "").trim();
  if (!name) return [];
  return entries
    .filter((entry) => entry.exercise === name && entry.bpm != null)
    .sort(compareAsc)
    .map((entry) => ({ id: entry.id, date: entry.date, bpm: entry.bpm }));
}

export function bpmSummary(points) {
  if (!points.length) return "";
  if (points.length === 1) return `${points[0].date} 是 ${points[0].bpm} BPM。`;
  const first = points[0];
  const last = points[points.length - 1];
  return `${first.date} 的 ${first.bpm} BPM 到 ${last.date} 的 ${last.bpm} BPM，共 ${points.length} 筆。`;
}

function xml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[ch]));
}

function shortDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${Number(match[2])}/${Number(match[3])}`;
}

function labelIndexes(count) {
  if (count <= 6) return [...Array(count).keys()];
  const mid = Math.floor((count - 1) / 2);
  return [...new Set([0, mid, count - 1])];
}

export function bpmChart(points, options = {}) {
  const limit = options.limit ?? 40;
  const shown = points.length > limit ? points.slice(points.length - limit) : points;
  return {
    svg: bpmChartSvg(shown),
    shown: shown.length,
    total: points.length,
    summary: bpmSummary(shown),
  };
}

export function bpmChartSvg(points) {
  if (!points.length) return "";
  const width = Math.max(320, 56 + points.length * 48);
  const height = 188;
  const pad = { l: 42, r: 14, t: 18, b: 32 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const bpms = points.map((point) => point.bpm);
  const dataMin = Math.min(...bpms);
  const dataMax = Math.max(...bpms);
  let min = dataMin;
  let max = dataMax;
  if (min === max) {
    min -= 4;
    max += 4;
  } else {
    const gutter = Math.max(2, Math.round((max - min) * 0.18));
    min -= gutter;
    max += gutter;
  }
  if (min < 0) min = 0;
  const xAt = (index) => pad.l + (points.length === 1 ? innerW / 2 : (innerW * index) / (points.length - 1));
  const yAt = (bpm) => pad.t + ((max - bpm) / (max - min || 1)) * innerH;
  const coords = points.map((point, index) => [xAt(index), yAt(point.bpm)]);
  const line = coords.map((coord, index) => `${index === 0 ? "M" : "L"}${coord[0].toFixed(1)} ${coord[1].toFixed(1)}`).join(" ");
  const dots = points
    .map(
      (point, index) =>
        `<circle class="dot" cx="${coords[index][0].toFixed(1)}" cy="${coords[index][1].toFixed(1)}" r="4.5"><title>${xml(point.date)} · ${point.bpm} BPM</title></circle>`,
    )
    .join("");
  const labels = labelIndexes(points.length)
    .map(
      (index) =>
        `<text class="axis" x="${xAt(index).toFixed(1)}" y="${height - 10}" text-anchor="middle">${xml(shortDate(points[index].date))}</text>`,
    )
    .join("");
  const yLabels =
    dataMin === dataMax
      ? `<text class="axis" x="${pad.l - 8}" y="${(yAt(dataMax) + 4).toFixed(1)}" text-anchor="end">${dataMax}</text>`
      : `<text class="axis" x="${pad.l - 8}" y="${(yAt(dataMax) + 4).toFixed(1)}" text-anchor="end">${dataMax}</text><text class="axis" x="${pad.l - 8}" y="${(yAt(dataMin) + 4).toFixed(1)}" text-anchor="end">${dataMin}</text>`;
  const summary = bpmSummary(points);
  return `<svg class="bpm-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(summary)}"><title>${xml(summary)}</title><line class="grid" x1="${pad.l}" y1="${yAt(dataMax).toFixed(1)}" x2="${width - pad.r}" y2="${yAt(dataMax).toFixed(1)}" /><line class="grid" x1="${pad.l}" y1="${yAt(dataMin).toFixed(1)}" x2="${width - pad.r}" y2="${yAt(dataMin).toFixed(1)}" />${yLabels}${points.length > 1 ? `<path class="line" d="${line}" />` : ""}${dots}${labels}</svg>`;
}

function markdownCell(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\|/g, "／")
    .trim();
}

export function entriesToMarkdown(entries) {
  const lines = [MARKDOWN_HEADER, "| --- | --- | --- | --- | --- | --- | --- |"];
  for (const entry of [...entries].sort(compareAsc)) {
    const cells = [
      entry.date,
      formatStageWeek(entry.stage, entry.week),
      entry.exercise,
      formatDuration(entry.durationSec),
      entry.bpm == null ? "" : String(entry.bpm),
      entry.rating == null ? "" : String(entry.rating),
      entry.stuck,
    ].map(markdownCell);
    lines.push(`| ${cells.join(" | ")} |`);
  }
  return lines.join("\n");
}

export function toBackup(entries, now = new Date()) {
  return {
    version: 1,
    exportedAt: now.toISOString(),
    entries: [...entries].sort(compareAsc),
  };
}

export function fromBackup(text) {
  let data;
  try {
    data = typeof text === "string" ? JSON.parse(text) : text;
  } catch {
    const error = new Error("這份備份讀不起來。");
    error.code = "bad-json";
    throw error;
  }
  const list = Array.isArray(data) ? data : data?.entries;
  if (!Array.isArray(list)) {
    const error = new Error("這份備份沒有紀錄。");
    error.code = "no-entries";
    throw error;
  }
  return list.map((item) => normalizeEntry(item)).filter(Boolean);
}

export function mergeEntries(current, incoming) {
  const map = new Map();
  for (const entry of current) map.set(entry.id, entry);
  for (const entry of incoming) map.set(entry.id, entry);
  return [...map.values()].sort(compareAsc);
}

export function loadEntries(storage) {
  try {
    const raw = storage?.getItem?.(STORAGE_KEY);
    if (!raw) return [];
    return fromBackup(raw);
  } catch {
    return [];
  }
}

export function saveEntries(entries, storage) {
  try {
    storage?.setItem?.(STORAGE_KEY, JSON.stringify(toBackup(entries)));
  } catch {
    /* private mode may reject storage */
  }
}

export function normalizeTimer(raw) {
  const status = raw?.status === "running" || raw?.status === "paused" ? raw.status : "idle";
  const accumulatedMs = Number.isFinite(Number(raw?.accumulatedMs)) ? Math.max(0, Number(raw.accumulatedMs)) : 0;
  const startedAt = Number.isFinite(Number(raw?.startedAt)) ? Number(raw.startedAt) : null;
  if (status !== "running") return { status, accumulatedMs, startedAt: null };
  return { status, accumulatedMs, startedAt };
}

export function timerElapsedMs(timer, nowMs) {
  const current = normalizeTimer(timer);
  if (current.status === "running" && current.startedAt != null) {
    return current.accumulatedMs + Math.max(0, nowMs - current.startedAt);
  }
  return current.accumulatedMs;
}

export function startTimer(timer, nowMs) {
  const current = normalizeTimer(timer);
  if (current.status === "running") return current;
  return { status: "running", accumulatedMs: current.accumulatedMs, startedAt: nowMs };
}

export function pauseTimer(timer, nowMs) {
  const current = normalizeTimer(timer);
  if (current.status !== "running") return current;
  return { status: "paused", accumulatedMs: timerElapsedMs(current, nowMs), startedAt: null };
}

export function stopTimer(timer, nowMs) {
  return {
    timer: { status: "idle", accumulatedMs: 0, startedAt: null },
    elapsedMs: timerElapsedMs(timer, nowMs),
  };
}

export function loadTimer(storage) {
  try {
    const raw = storage?.getItem?.(TIMER_KEY);
    if (!raw) return { ...IDLE_TIMER };
    return normalizeTimer(JSON.parse(raw));
  } catch {
    return { ...IDLE_TIMER };
  }
}

export function saveTimer(timer, storage) {
  try {
    storage?.setItem?.(TIMER_KEY, JSON.stringify(normalizeTimer(timer)));
  } catch {
    /* private mode may reject storage */
  }
}
