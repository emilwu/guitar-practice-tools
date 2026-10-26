import { Chord, Interval, Note } from "../vendor/tonal/tonal.js";
import { mod } from "./pitch.js";

const LABEL = {
  "1P": "R",
  "2m": "b9",
  "2M": "2",
  "3m": "b3",
  "3M": "3",
  "4P": "4",
  "4A": "#4",
  "5d": "b5",
  "5P": "5",
  "5A": "#5",
  "6m": "b13",
  "6M": "6",
  "7d": "bb7",
  "7m": "b7",
  "7M": "7",
  "9m": "b9",
  "9M": "9",
  "9A": "#9",
  "11P": "11",
  "11A": "#11",
  "13m": "b13",
  "13M": "13",
};

export function displayName(note) {
  if (!note) return "";
  if (note.includes("##") || note.includes("bb")) return Note.enharmonic(note);
  return note;
}

export function normalizeSymbol(raw) {
  let s = String(raw ?? "").trim().replace(/\s+/g, "");
  if (!s) return "";
  s = s.replace(/[Δ∆]/g, "maj").replace(/[Øø]/g, "m7b5").replace(/°/g, "dim");
  s = s.replace(/♭/g, "b").replace(/♯/g, "#");
  // "dim7" / "m7" / "sus4" are qualities, not roots. "dm7" and "am7" are rooted.
  if (/^(?:maj|min|minor|dim|aug|sus|add|alt|m(?!aj))/i.test(s)) return s;
  return s.replace(/^([a-g])/, (letter) => letter.toUpperCase());
}

function toTones(intervals, notes) {
  return intervals.map((interval, i) => {
    const info = Interval.get(interval);
    const note = notes[i] || "";
    return {
      interval,
      label: LABEL[interval] || interval,
      note,
      display: displayName(note),
      pc: mod((info.chroma ?? 0) + (notes[0] ? Note.chroma(notes[0]) : 0), 12),
      semitones: info.semitones,
    };
  });
}

function decorate(found, input) {
  if (!found || found.empty || !found.tonic || !found.notes?.length) {
    return { empty: true, input, symbol: input };
  }
  const tones = toTones(found.intervals, found.notes);
  // Recompute pc from each note so compound intervals stay correct.
  tones.forEach((tone, i) => {
    tone.pc = Note.chroma(found.notes[i]);
    tone.display = displayName(found.notes[i]);
  });
  const symbol = canonicalize(found);
  return {
    empty: false,
    input,
    symbol,
    root: found.tonic,
    rootPc: Note.chroma(found.tonic),
    intervals: found.intervals.slice(),
    labels: tones.map((t) => t.label),
    notes: found.notes.slice(),
    displayNotes: tones.map((t) => t.display),
    formula: tones.map((t) => t.label).join(" "),
    pcs: tones.map((t) => t.pc),
    tones,
    type: found.type || "",
    quality: found.quality || "",
    qualityKey: qualityKeyFrom(found.intervals),
    family: familyFrom(found.intervals),
  };
}

function canonicalize(found) {
  const symbol = found.symbol || "";
  return symbol.replace(/^([A-G][#b]?)M(?!aj)/, "$1maj");
}

export function parseChord(raw) {
  const input = normalizeSymbol(raw);
  if (!input) return { empty: true, input: "", symbol: "" };
  let found = Chord.get(input);
  if (found.empty || !found.notes?.length) {
    if (!/^[A-G]/.test(input)) found = Chord.get(`C${input}`);
  }
  return decorate(found, input);
}

export function qualityKeyFrom(intervals) {
  const has = (i) => intervals.includes(i);
  if (has("9A") && has("7m") && has("5A")) return "alt";
  if (has("9A") && has("7m")) return "7#9";
  if (has("9m") && has("7m") && has("3M")) return "7b9";
  if (has("3m") && has("5d") && has("7d")) return "dim7";
  if (has("3m") && has("5d") && has("7m")) return "m7b5";
  if (has("3m") && has("5d")) return "dim";
  if ((has("4P") || has("11P")) && !has("3M") && !has("3m") && has("7m")) return "7sus4";
  if (has("4P") && !has("3M") && !has("3m")) return "sus4";
  if (has("2M") && !has("3M") && !has("3m") && !has("4P") && !has("7m") && !has("7M")) return "sus2";
  if (has("5A") && has("3M") && has("7m")) return "aug7";
  if (has("5A") && has("3M") && !has("7m") && !has("7M")) return "aug";
  if (has("13M") && has("7m")) return "13";
  if (has("11P") && has("7m") && !has("3M") && !has("3m")) return "11";
  if (has("9M") && has("7M") && has("3m")) return "mmaj9";
  if (has("9M") && has("7M")) return "maj9";
  if (has("9M") && has("7m") && has("3m")) return "m9";
  if (has("9M") && has("7m") && has("3M")) return "9";
  if (has("9M") && has("3m") && !has("7m") && !has("7M")) return "madd9";
  if (has("9M") && has("3M") && !has("7m") && !has("7M")) return "add9";
  if (has("7M") && has("3m")) return "mmaj7";
  if (has("7M") && has("3M")) return "maj7";
  if (has("7m") && has("3m")) return "m7";
  if (has("7m") && has("3M")) return "7";
  if (has("6M") && has("3m")) return "m6";
  if (has("6M") && has("3M")) return "6";
  if (has("3m")) return "minor";
  if (has("3M")) return "major";
  return "other";
}

export function familyFrom(intervals) {
  const key = qualityKeyFrom(intervals);
  if (key === "m7b5") return "m7b5";
  if (key === "dim" || key === "dim7") return "dim";
  if (key === "aug" || key === "aug7" || key === "alt") return "aug";
  if (key === "sus2" || key === "sus4" || key === "7sus4") return "sus";
  if (["minor", "m7", "m9", "m6", "madd9", "mmaj7", "mmaj9"].includes(key)) return "m";
  if (["7", "9", "7b9", "7#9", "13", "11"].includes(key)) return "7";
  if (["major", "maj7", "maj9", "6", "add9"].includes(key)) return "maj";
  return "other";
}

/** Pitch classes a grip must contain so it still sounds like this chord. */
export function requiredPcs(chord) {
  const iv = new Map(chord.tones.map((t) => [t.interval, t.pc]));
  const need = [];
  const push = (interval) => {
    if (iv.has(interval)) need.push(iv.get(interval));
  };
  push("1P");
  if (iv.has("3M")) push("3M");
  else if (iv.has("3m")) push("3m");
  else if (iv.has("4P")) push("4P");
  else if (iv.has("2M")) push("2M");
  if (iv.has("7d")) push("7d");
  else if (iv.has("7m")) push("7m");
  else if (iv.has("7M")) push("7M");
  if (iv.has("5d") && !iv.has("5P")) push("5d");
  if (iv.has("5A") && !iv.has("5P")) push("5A");
  if (iv.has("9m")) push("9m");
  if (iv.has("9A")) push("9A");
  if (iv.has("9M")) push("9M");
  return [...new Set(need)];
}

export function triadMembers(chord) {
  const iv = new Map(chord.tones.map((t) => [t.interval, t]));
  const root = iv.get("1P");
  if (!root) return [];
  let third = iv.get("3M") || iv.get("3m");
  let fifth = iv.get("5P") || iv.get("5d") || iv.get("5A");
  if (!third && iv.get("4P")) third = iv.get("4P");
  if (!third && iv.get("2M")) third = iv.get("2M");
  if (!third || !fifth) return [];
  return [root, third, fifth];
}
