/**
 * Fretboard presets live in the URL hash so another site can deep-link them.
 *
 *   #mode=find&naturals=1&frets=0-12&timer=60
 *   #mode=name&spell=flat&strings=321
 *   #mode=interval&imode=locate&degrees=b3,3,5,b7
 *   #mode=interval&imode=name
 *   #mode=scale&key=A&scale=min-pent&shape=E
 *
 * Hash keys: mode, imode, strings, frets, naturals, timer, spell, sound,
 * key, scale, shape, degrees. Missing keys use the defaults below.
 * Sharp signs in note names are percent-encoded (`key=F%23`).
 */
import { CANONICAL_DEGREES, canonicalDegree, pcFromName, scaleById, shapeById } from "./logic.js";

export const SETTINGS_KEY = "guitar-tools.fretboard.v1";

export const DEFAULT_SETTINGS = {
  mode: "find",
  imode: "locate",
  strings: [6, 5, 4, 3, 2, 1],
  fretMin: 0,
  fretMax: 12,
  naturals: false,
  timer: 0,
  spell: "sharp",
  sound: true,
  key: "A",
  scale: "min-pent",
  shape: "E",
  degrees: CANONICAL_DEGREES.slice(),
};

const MODES = new Set(["find", "name", "interval", "scale"]);
const HASH_KEYS = ["mode", "imode", "strings", "frets", "naturals", "timer", "spell", "sound", "key", "scale", "shape", "degrees"];

function copyDefaults() {
  return {
    ...DEFAULT_SETTINGS,
    strings: DEFAULT_SETTINGS.strings.slice(),
    degrees: DEFAULT_SETTINGS.degrees.slice(),
  };
}

function clampFret(value, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(15, Math.max(0, number));
}

export function normalizeSettings(raw) {
  const next = copyDefaults();
  if (!raw || typeof raw !== "object") return next;
  if (MODES.has(raw.mode)) next.mode = raw.mode;
  if (raw.imode === "name" || raw.imode === "find") next.imode = raw.imode === "find" ? "locate" : raw.imode;
  if (raw.imode === "locate") next.imode = "locate";

  if (Array.isArray(raw.strings)) {
    const strings = [...new Set(raw.strings.map(Number).filter((string) => string >= 1 && string <= 6))];
    if (strings.length) next.strings = strings.sort((a, b) => b - a);
  }

  next.fretMin = clampFret(raw.fretMin, next.fretMin);
  next.fretMax = clampFret(raw.fretMax, next.fretMax);
  if (next.fretMin > next.fretMax) {
    const swap = next.fretMin;
    next.fretMin = next.fretMax;
    next.fretMax = swap;
  }

  next.naturals = raw.naturals === true || raw.naturals === 1 || raw.naturals === "1";
  const timer = Number(raw.timer);
  if (Number.isFinite(timer) && timer > 0) next.timer = Math.min(600, Math.round(timer));
  if (raw.spell === "flat" || raw.spell === "sharp") next.spell = raw.spell;
  if (raw.sound === false || raw.sound === 0 || raw.sound === "0") next.sound = false;

  if (pcFromName(raw.key) != null) next.key = String(raw.key).trim().replace(/^([a-g])/, (letter) => letter.toUpperCase());
  if (scaleById(raw.scale)) next.scale = scaleById(raw.scale).id;
  if (raw.shape) next.shape = shapeById(raw.shape).id;

  if (Array.isArray(raw.degrees)) {
    const degrees = [];
    for (const label of CANONICAL_DEGREES) {
      if (raw.degrees.some((item) => canonicalDegree(item) === label)) degrees.push(label);
    }
    if (degrees.length) next.degrees = degrees;
  }
  return next;
}

function parseStrings(value) {
  const nums = String(value || "").match(/[1-6]/g);
  if (!nums?.length) return null;
  return [...new Set(nums.map(Number))].sort((a, b) => b - a);
}

function parseDegrees(value) {
  const parts = String(value || "").split(/[,\s]+/);
  const degrees = [];
  for (const label of CANONICAL_DEGREES) {
    if (parts.some((item) => canonicalDegree(item) === label)) degrees.push(label);
  }
  return degrees.length ? degrees : null;
}

export function parseHash(hash) {
  const raw = String(hash || "").replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  if (![...params.keys()].some((key) => HASH_KEYS.includes(key))) return null;
  const draft = copyDefaults();
  if (params.has("mode") && MODES.has(params.get("mode"))) draft.mode = params.get("mode");
  if (params.has("imode")) draft.imode = params.get("imode");
  if (params.has("strings")) {
    const strings = parseStrings(params.get("strings"));
    if (strings) draft.strings = strings;
  }
  if (params.has("frets")) {
    const match = String(params.get("frets") || "").match(/^(\d+)\s*-\s*(\d+)$/);
    if (match) {
      draft.fretMin = Number(match[1]);
      draft.fretMax = Number(match[2]);
    }
  }
  if (params.has("naturals")) draft.naturals = params.get("naturals") === "1";
  if (params.has("timer")) draft.timer = params.get("timer");
  if (params.has("spell")) draft.spell = params.get("spell");
  if (params.has("sound")) draft.sound = params.get("sound") === "0" ? false : true;
  if (params.has("key")) draft.key = params.get("key");
  if (params.has("scale")) draft.scale = params.get("scale");
  if (params.has("shape")) draft.shape = params.get("shape");
  if (params.has("degrees")) {
    const degrees = parseDegrees(params.get("degrees"));
    if (degrees) draft.degrees = degrees;
  }
  return normalizeSettings(draft);
}

function sameList(a, b) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

export function serializeHash(settings) {
  const state = normalizeSettings(settings);
  const params = new URLSearchParams();
  if (state.mode !== DEFAULT_SETTINGS.mode) params.set("mode", state.mode);
  if (state.imode !== DEFAULT_SETTINGS.imode) params.set("imode", state.imode);
  if (!sameList(state.strings, DEFAULT_SETTINGS.strings)) params.set("strings", state.strings.join(""));
  if (state.fretMin !== DEFAULT_SETTINGS.fretMin || state.fretMax !== DEFAULT_SETTINGS.fretMax) {
    params.set("frets", `${state.fretMin}-${state.fretMax}`);
  }
  if (state.naturals) params.set("naturals", "1");
  if (state.timer) params.set("timer", String(state.timer));
  if (state.spell !== DEFAULT_SETTINGS.spell) params.set("spell", state.spell);
  if (!state.sound) params.set("sound", "0");
  if (state.key !== DEFAULT_SETTINGS.key) params.set("key", state.key);
  if (state.scale !== DEFAULT_SETTINGS.scale) params.set("scale", state.scale);
  if (state.shape !== DEFAULT_SETTINGS.shape) params.set("shape", state.shape);
  if (!sameList(state.degrees, DEFAULT_SETTINGS.degrees)) params.set("degrees", state.degrees.join(","));
  return params.toString();
}

export function loadSettings(hash, storage) {
  const fromHash = parseHash(hash);
  if (fromHash) return fromHash;
  try {
    const raw = storage?.getItem?.(SETTINGS_KEY);
    if (raw) return normalizeSettings(JSON.parse(raw));
  } catch {
    /* ignore broken storage */
  }
  return copyDefaults();
}

export function saveSettings(settings, storage) {
  try {
    storage?.setItem?.(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
  } catch {
    /* private mode */
  }
}
