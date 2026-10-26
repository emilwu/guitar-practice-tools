/** Lifetime accuracy for the fretboard trainer. Pure: no localStorage required. */
import { noteName } from "./logic.js";

export const STATS_KEY = "guitar-tools.fretboard.stats.v1";

function blankBucket() {
  return { attempts: 0, correct: 0, totalMs: 0, timed: 0 };
}

export function emptyStats() {
  return { notes: {}, strings: {}, cells: {} };
}

function copyMap(map) {
  const next = {};
  for (const [key, bucket] of Object.entries(map || {})) {
    next[key] = {
      attempts: Number(bucket?.attempts) || 0,
      correct: Number(bucket?.correct) || 0,
      totalMs: Number(bucket?.totalMs) || 0,
      timed: Number(bucket?.timed) || 0,
    };
  }
  return next;
}

export function normalizeStats(raw) {
  if (!raw || typeof raw !== "object") return emptyStats();
  return { notes: copyMap(raw.notes), strings: copyMap(raw.strings), cells: copyMap(raw.cells) };
}

function bump(map, key, correct, ms) {
  const bucket = map[key] ? { ...map[key] } : blankBucket();
  bucket.attempts += 1;
  if (correct) bucket.correct += 1;
  if (Number.isFinite(ms) && ms >= 0) {
    bucket.totalMs += ms;
    bucket.timed += 1;
  }
  map[key] = bucket;
}

export function recordStat(stats, { pc, string, stringIndex, fret, correct, ms = null }) {
  const next = normalizeStats(stats);
  bump(next.notes, String(modPc(pc)), correct, ms);
  bump(next.strings, String(string), correct, ms);
  bump(next.cells, `${stringIndex}:${fret}`, correct, ms);
  return next;
}

function modPc(pc) {
  return ((Number(pc) % 12) + 12) % 12;
}

export function summarize(bucket) {
  const attempts = bucket?.attempts || 0;
  const correct = bucket?.correct || 0;
  const timed = bucket?.timed || 0;
  const totalMs = bucket?.totalMs || 0;
  return {
    attempts,
    correct,
    accuracy: attempts ? correct / attempts : null,
    avgMs: timed ? totalMs / timed : null,
  };
}

export function heatmapCells(stats) {
  const cells = [];
  for (const [key, bucket] of Object.entries(stats?.cells || {})) {
    const [stringIndex, fret] = key.split(":").map(Number);
    if (!Number.isInteger(stringIndex) || !Number.isInteger(fret)) continue;
    const summary = summarize(bucket);
    cells.push({
      stringIndex,
      string: 6 - stringIndex,
      fret,
      ...summary,
      weakness: summary.attempts ? 1 - summary.accuracy : 0,
    });
  }
  cells.sort(
    (a, b) => b.weakness - a.weakness || b.attempts - a.attempts || a.stringIndex - b.stringIndex || a.fret - b.fret,
  );
  return cells;
}

export function noteRows(stats, spell = "sharp") {
  const rows = [];
  for (let pc = 0; pc < 12; pc += 1) {
    const summary = summarize(stats?.notes?.[String(pc)]);
    if (!summary.attempts) continue;
    rows.push({ pc, name: noteName(pc, spell), ...summary, weakness: 1 - summary.accuracy });
  }
  rows.sort((a, b) => b.weakness - a.weakness || b.attempts - a.attempts || a.pc - b.pc);
  return rows;
}

export function stringRows(stats) {
  const rows = [];
  for (let string = 6; string >= 1; string -= 1) {
    const summary = summarize(stats?.strings?.[String(string)]);
    if (!summary.attempts) continue;
    rows.push({ string, ...summary, weakness: 1 - summary.accuracy });
  }
  return rows;
}

export function loadStats(storage) {
  try {
    const raw = storage?.getItem?.(STATS_KEY);
    if (!raw) return emptyStats();
    return normalizeStats(JSON.parse(raw));
  } catch {
    return emptyStats();
  }
}

export function saveStats(storage, stats) {
  try {
    storage?.setItem?.(STATS_KEY, JSON.stringify(normalizeStats(stats)));
  } catch {
    /* private mode */
  }
}
