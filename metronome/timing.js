/**
 * Metronome timing, mute bars, BPM ladder, tap tempo, and the URL hash preset.
 * The hash keys are a stable contract for the learning map. See AGENTS.md.
 * bpm, meter, subdivision, swing, accents, mute, ladder.
 */

export const BPM_MIN = 30;
export const BPM_MAX = 300;
export const SWING_MIN = 50;
export const SWING_MAX = 75;
/** Integer percent stored in links. Nearest whole number to a 2:1 triplet. */
export const TRIPLET_SWING_PERCENT = 67;
/** Exact first-eighth share of the beat for a 2:1 triplet swing. */
export const TRIPLET_SWING_EXACT = 200 / 3;
export const STORAGE_KEY = "guitar-tools.metronome.v1";
export const TAP_RESET_MS = 2000;
export const TAP_MAX = 6;

export const HASH_EXAMPLE = "bpm=60&meter=4/4&subdivision=eighth&swing=50&accents=mama";

export const HASH_KEYS = ["bpm", "meter", "subdivision", "swing", "accents", "mute", "ladder", "volume", "flash"];

export const METERS = [
  { id: "2/4", beats: 2, unit: 4, compound: false, label: "2/4", hint: "一拍是四分音符，一小節 2 拍。" },
  { id: "3/4", beats: 3, unit: 4, compound: false, label: "3/4", hint: "一拍是四分音符，一小節 3 拍。" },
  { id: "4/4", beats: 4, unit: 4, compound: false, label: "4/4", hint: "一拍是四分音符，一小節 4 拍。" },
  { id: "5/4", beats: 5, unit: 4, compound: false, label: "5/4", hint: "一拍是四分音符，一小節 5 拍。" },
  { id: "6/8", beats: 6, unit: 8, compound: true, label: "6/8", hint: "一拍是八分音符，共 6 拍。預設每 3 拍一個重音，聽起來是兩大拍。" },
  { id: "7/8", beats: 7, unit: 8, compound: false, label: "7/8", hint: "一拍是八分音符，共 7 拍。點拍點可以分成 2+2+3 或 3+2+2。" },
  { id: "12/8", beats: 12, unit: 8, compound: true, label: "12/8", hint: "一拍是八分音符，共 12 拍。預設每 3 拍一個重音，適合慢速 Blues 與 Neo Soul。" },
];

export const SUBDIVISIONS = [
  { id: "quarter", parts: 1, label: "四分" },
  { id: "eighth", parts: 2, label: "八分" },
  { id: "triplet", parts: 3, label: "三連音" },
  { id: "sixteenth", parts: 4, label: "十六分" },
];

const ACCENT_CYCLE = ["accent", "normal", "mute"];
const ACCENT_CODE = { accent: "a", normal: "n", mute: "m" };
const CODE_ACCENT = { a: "accent", n: "normal", m: "mute" };

export const DEFAULT_STATE = {
  bpm: 100,
  meter: "4/4",
  subdivision: "quarter",
  swing: SWING_MIN,
  accents: ["accent", "normal", "normal", "normal"],
  playBars: 2,
  muteBars: 0,
  ladderOn: false,
  ladderStart: 80,
  ladderTarget: 120,
  ladderStep: 5,
  ladderBars: 4,
  volume: 80,
  flash: false,
};

export function meterSpec(id) {
  return METERS.find((meter) => meter.id === id) || METERS.find((meter) => meter.id === "4/4");
}

export function subdivisionSpec(id) {
  return SUBDIVISIONS.find((item) => item.id === id) || SUBDIVISIONS[0];
}

export function clampBpm(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_STATE.bpm;
  return Math.min(BPM_MAX, Math.max(BPM_MIN, n));
}

export function clampSwing(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return SWING_MIN;
  return Math.min(SWING_MAX, Math.max(SWING_MIN, n));
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function defaultAccents(meter) {
  const spec = meterSpec(meter);
  if (spec.compound) {
    return Array.from({ length: spec.beats }, (_, index) => (index % 3 === 0 ? "accent" : "normal"));
  }
  return Array.from({ length: spec.beats }, (_, index) => (index === 0 ? "accent" : "normal"));
}

/** Jazz ride: clicks on beats 2 and 4. Beats 1 and 3 are silent. Later beats stay normal. */
export function jazzAccents(meter) {
  const beats = meterSpec(meter).beats;
  return Array.from({ length: beats }, (_, index) => {
    const beat = index + 1;
    if (beat === 2 || beat === 4) return "accent";
    if (beat === 1 || beat === 3) return "mute";
    return "normal";
  });
}

export function cycleAccent(level) {
  const index = ACCENT_CYCLE.indexOf(level);
  return ACCENT_CYCLE[(index + 1) % ACCENT_CYCLE.length];
}

export function formatAccents(list) {
  return (list || []).map((level) => ACCENT_CODE[level] || "n").join("");
}

export function parseAccents(raw, meter) {
  const beats = meterSpec(meter).beats;
  const text = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (text.length !== beats || [...text].some((char) => !CODE_ACCENT[char])) return defaultAccents(meter);
  return [...text].map((char) => CODE_ACCENT[char]);
}

export function subdivisionHint(meter) {
  if (meterSpec(meter).unit === 8) return "細分是再拆這一拍（八分音符）。選「四分」代表這一拍只響一下。";
  return "細分是再拆這一拍（四分音符）。八分可以加 Swing。";
}

export function swingHint(subdivision) {
  if (subdivision !== "eighth") return "Swing 只套在八分音符。換成八分之後，這個百分比才會進到點擊。";
  return "50% 平直，67% 接近三連音 2:1，75% 是第一個音三倍長。";
}

/**
 * Offsets of the two eighth notes inside one beat, in seconds.
 * swingPercent is the first note's share of the beat: 50 straight, ~66.7 triplet 2:1, 75 is 3:1.
 */
export function eighthSwingOffsets(beatSeconds, swingPercent) {
  const beat = Number(beatSeconds);
  const safe = Number.isFinite(beat) && beat > 0 ? beat : 1e-4;
  const ratio = clampSwing(swingPercent) / 100;
  return [0, safe * ratio];
}

export function clickOffsets(beatSeconds, subdivision, swingPercent) {
  const spec = subdivisionSpec(subdivision);
  const beat = Number(beatSeconds);
  const safe = Number.isFinite(beat) && beat > 0 ? beat : 1e-4;
  if (spec.id === "eighth") {
    const [first, second] = eighthSwingOffsets(safe, swingPercent);
    return [
      { time: first, kind: "beat" },
      { time: second, kind: "sub" },
    ];
  }
  const step = safe / spec.parts;
  return Array.from({ length: spec.parts }, (_, index) => ({
    time: step * index,
    kind: index === 0 ? "beat" : "sub",
  }));
}

/** Seconds until the next click. Swing delays only the second eighth. */
export function stepDuration(beatSeconds, subdivision, swingPercent, subIndex) {
  const spec = subdivisionSpec(subdivision);
  const beat = Number(beatSeconds);
  const safe = Number.isFinite(beat) && beat > 0 ? beat : 1e-4;
  if (spec.id === "eighth") {
    const ratio = clampSwing(swingPercent) / 100;
    const delta = subIndex === 0 ? safe * ratio : safe * (1 - ratio);
    return Math.max(delta, 1e-4);
  }
  return Math.max(safe / spec.parts, 1e-4);
}

export function advancePosition(pos, meter, subdivision) {
  const beats = meterSpec(meter).beats;
  const parts = subdivisionSpec(subdivision).parts;
  let bar = pos.bar;
  let beat = pos.beat;
  let sub = pos.sub + 1;
  if (sub >= parts) {
    sub = 0;
    beat += 1;
  }
  if (beat >= beats) {
    beat = 0;
    bar += 1;
  }
  return { bar, beat, sub };
}

export function normalizePosition(pos, meter, subdivision) {
  const beats = meterSpec(meter).beats;
  const parts = subdivisionSpec(subdivision).parts;
  let bar = Math.max(0, Math.floor(Number(pos?.bar)) || 0);
  let beat = Math.max(0, Math.floor(Number(pos?.beat)) || 0);
  let sub = Math.max(0, Math.floor(Number(pos?.sub)) || 0);
  if (sub >= parts) {
    sub = 0;
    beat += 1;
  }
  if (beat >= beats) {
    beat = 0;
    bar += 1;
  }
  return { bar, beat, sub };
}

export function barAudible(barIndex, playBars, muteBars) {
  const play = Math.max(1, Math.round(Number(playBars)) || 1);
  const mute = Math.max(0, Math.round(Number(muteBars)) || 0);
  if (mute === 0) return true;
  const bar = Math.max(0, Math.floor(Number(barIndex)) || 0);
  return bar % (play + mute) < play;
}

export function gapStatus(barIndex, playBars, muteBars) {
  const play = Math.max(1, Math.round(Number(playBars)) || 1);
  const mute = Math.max(0, Math.round(Number(muteBars)) || 0);
  if (mute <= 0) return { audible: true, label: "" };
  const bar = Math.max(0, Math.floor(Number(barIndex)) || 0);
  const pos = bar % (play + mute);
  if (pos < play) return { audible: true, label: `出聲 ${pos + 1}/${play}` };
  return { audible: false, label: `靜音 ${pos - play + 1}/${mute}` };
}

export function soundAt(pos, state) {
  if (!barAudible(pos.bar, state.playBars, state.muteBars)) return null;
  const level = state.accents?.[pos.beat] || "normal";
  if (level === "mute") return null;
  if (pos.sub === 0) return level;
  return "subdivision";
}

export function ladderBpms(start, target, step) {
  const from = clampBpm(start);
  const to = clampBpm(target);
  const size = Math.max(1, Math.min(BPM_MAX - BPM_MIN, Math.round(Math.abs(Number(step))) || 1));
  if (from === to) return [from];
  const dir = to > from ? 1 : -1;
  const bpms = [];
  for (let bpm = from; dir > 0 ? bpm < to : bpm > to; bpm += dir * size) {
    bpms.push(bpm);
    if (bpms.length > 300) break;
  }
  if (bpms[bpms.length - 1] !== to) bpms.push(to);
  return bpms;
}

export function ladderAtBar(barIndex, state) {
  const bpms = ladderBpms(state.ladderStart, state.ladderTarget, state.ladderStep);
  const bars = clampInt(state.ladderBars, 1, 64, DEFAULT_STATE.ladderBars);
  const bar = Math.max(0, Math.floor(Number(barIndex)) || 0);
  const planned = bpms.length * bars;
  const finished = bar >= planned;
  const index = Math.min(bpms.length - 1, Math.floor(bar / bars));
  return {
    bpms,
    bpm: bpms[index],
    index,
    count: bpms.length,
    barInStep: finished ? bars - 1 : bar % bars,
    bars,
    finished,
  };
}

export function resolveBpm(barIndex, state) {
  if (!state.ladderOn) return clampBpm(state.bpm);
  return ladderAtBar(barIndex, state).bpm;
}

export function normalizeState(input) {
  const source = input || {};
  const meter = METERS.some((item) => item.id === source.meter) ? source.meter : DEFAULT_STATE.meter;
  const subdivision = SUBDIVISIONS.some((item) => item.id === source.subdivision) ? source.subdivision : DEFAULT_STATE.subdivision;
  const beats = meterSpec(meter).beats;
  const accentsOk =
    Array.isArray(source.accents) &&
    source.accents.length === beats &&
    source.accents.every((level) => level === "accent" || level === "normal" || level === "mute");
  return {
    bpm: clampBpm(source.bpm ?? DEFAULT_STATE.bpm),
    meter,
    subdivision,
    swing: Math.round(clampSwing(source.swing ?? DEFAULT_STATE.swing)),
    accents: accentsOk ? source.accents.slice() : defaultAccents(meter),
    playBars: clampInt(source.playBars, 1, 32, DEFAULT_STATE.playBars),
    muteBars: clampInt(source.muteBars, 0, 32, DEFAULT_STATE.muteBars),
    ladderOn: source.ladderOn === true || source.ladderOn === 1 || source.ladderOn === "1" || source.ladderOn === "on",
    ladderStart: clampBpm(source.ladderStart ?? DEFAULT_STATE.ladderStart),
    ladderTarget: clampBpm(source.ladderTarget ?? DEFAULT_STATE.ladderTarget),
    ladderStep: clampInt(source.ladderStep, 1, BPM_MAX - BPM_MIN, DEFAULT_STATE.ladderStep),
    ladderBars: clampInt(source.ladderBars, 1, 64, DEFAULT_STATE.ladderBars),
    volume: clampInt(source.volume, 0, 100, DEFAULT_STATE.volume),
    flash: source.flash === true || source.flash === 1 || source.flash === "1" || source.flash === "true" || source.flash === "on",
  };
}

function parseMute(raw) {
  const text = String(raw || "").trim().toLowerCase();
  if (!text || text === "0" || text === "off") return { playBars: DEFAULT_STATE.playBars, muteBars: 0 };
  const match = text.match(/^(\d+)\/(\d+)$/);
  if (!match) return { playBars: DEFAULT_STATE.playBars, muteBars: 0 };
  return {
    playBars: clampInt(match[1], 1, 32, DEFAULT_STATE.playBars),
    muteBars: clampInt(match[2], 0, 32, 0),
  };
}

function ladderDefaults(on) {
  return {
    ladderOn: on,
    ladderStart: DEFAULT_STATE.ladderStart,
    ladderTarget: DEFAULT_STATE.ladderTarget,
    ladderStep: DEFAULT_STATE.ladderStep,
    ladderBars: DEFAULT_STATE.ladderBars,
  };
}

function ladderNumbers(match, on) {
  return {
    ladderOn: on,
    ladderStart: clampBpm(match[1]),
    ladderTarget: clampBpm(match[2]),
    ladderStep: clampInt(match[3], 1, BPM_MAX - BPM_MIN, 1),
    ladderBars: clampInt(match[4], 1, 64, 1),
  };
}

function parseLadder(raw) {
  const text = String(raw || "").trim().toLowerCase();
  if (!text || text === "0" || text === "off") return ladderDefaults(false);
  const remembered = text.match(/^off:(\d+)-(\d+)-(\d+)-(\d+)$/);
  if (remembered) return ladderNumbers(remembered, false);
  const enabled = text.match(/^(\d+)-(\d+)-(\d+)-(\d+)$/);
  if (enabled) return ladderNumbers(enabled, true);
  return ladderDefaults(false);
}

export function parseHash(hash) {
  const raw = String(hash ?? "")
    .replace(/^#/, "")
    .trim();
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  if (![...params.keys()].some((key) => HASH_KEYS.includes(key))) return null;
  const meter = params.has("meter") && METERS.some((item) => item.id === params.get("meter")) ? params.get("meter") : DEFAULT_STATE.meter;
  const accents = params.has("accents") ? parseAccents(params.get("accents"), meter) : defaultAccents(meter);
  const mute = params.has("mute") ? parseMute(params.get("mute")) : { playBars: DEFAULT_STATE.playBars, muteBars: DEFAULT_STATE.muteBars };
  const ladder = params.has("ladder")
    ? parseLadder(params.get("ladder"))
    : {
        ladderOn: false,
        ladderStart: DEFAULT_STATE.ladderStart,
        ladderTarget: DEFAULT_STATE.ladderTarget,
        ladderStep: DEFAULT_STATE.ladderStep,
        ladderBars: DEFAULT_STATE.ladderBars,
      };
  return normalizeState({
    bpm: params.has("bpm") ? params.get("bpm") : DEFAULT_STATE.bpm,
    meter,
    subdivision: params.has("subdivision") ? params.get("subdivision") : DEFAULT_STATE.subdivision,
    swing: params.has("swing") ? params.get("swing") : DEFAULT_STATE.swing,
    accents,
    ...mute,
    ...ladder,
    volume: params.has("volume") ? params.get("volume") : DEFAULT_STATE.volume,
    flash: params.has("flash") ? params.get("flash") : DEFAULT_STATE.flash,
  });
}

function ladderToken(state) {
  const spec = `${state.ladderStart}-${state.ladderTarget}-${state.ladderStep}-${state.ladderBars}`;
  if (state.ladderOn) return spec;
  const untouched = spec === `${DEFAULT_STATE.ladderStart}-${DEFAULT_STATE.ladderTarget}-${DEFAULT_STATE.ladderStep}-${DEFAULT_STATE.ladderBars}`;
  return untouched ? "off" : `off:${spec}`;
}

export function serializeHash(state) {
  const ready = normalizeState(state);
  const parts = [
    ["bpm", ready.bpm],
    ["meter", ready.meter],
    ["subdivision", ready.subdivision],
    ["swing", ready.swing],
    ["accents", formatAccents(ready.accents)],
    ["mute", `${ready.playBars}/${ready.muteBars}`],
    ["ladder", ladderToken(ready)],
  ];
  if (ready.volume !== DEFAULT_STATE.volume) parts.push(["volume", ready.volume]);
  if (ready.flash) parts.push(["flash", "1"]);
  return parts.map(([key, value]) => `${key}=${value}`).join("&");
}

export function loadState(hash, storage) {
  const fromHash = parseHash(hash);
  if (fromHash) return fromHash;
  try {
    const raw = storage?.getItem?.(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch {
    /* ignore broken storage */
  }
  return normalizeState(DEFAULT_STATE);
}

export function saveState(state, storage) {
  try {
    storage?.setItem?.(STORAGE_KEY, JSON.stringify(normalizeState(state)));
  } catch {
    /* private mode may reject storage */
  }
}

/** Average the latest tap intervals. A gap longer than two seconds starts over. */
export function averageTapTempo(timestamps, { resetMs = TAP_RESET_MS, maxTaps = TAP_MAX } = {}) {
  if (!Array.isArray(timestamps) || timestamps.length < 2) return null;
  const taps = timestamps.slice(-maxTaps).filter((time) => Number.isFinite(time));
  const intervals = [];
  for (let index = 1; index < taps.length; index += 1) {
    const gap = taps[index] - taps[index - 1];
    if (!(gap > 0) || gap > resetMs) {
      intervals.length = 0;
      continue;
    }
    intervals.push(gap);
  }
  if (!intervals.length) return null;
  const average = intervals.reduce((sum, gap) => sum + gap, 0) / intervals.length;
  return clampBpm(Math.round(60000 / average));
}

/** Expand `barCount` bars of clicks. Times are seconds from the downbeat. Muted events stay in the grid. */
export function walkClicks(barCount, state) {
  const ready = normalizeState(state);
  const beats = meterSpec(ready.meter).beats;
  const parts = subdivisionSpec(ready.subdivision).parts;
  const total = Math.max(0, barCount) * beats * parts;
  const events = [];
  let pos = { bar: 0, beat: 0, sub: 0 };
  let time = 0;
  for (let index = 0; index < total; index += 1) {
    const bpm = resolveBpm(pos.bar, ready);
    events.push({
      time,
      bar: pos.bar,
      beat: pos.beat,
      sub: pos.sub,
      bpm,
      sound: soundAt(pos, ready),
    });
    time += stepDuration(60 / bpm, ready.subdivision, ready.swing, pos.sub);
    pos = advancePosition(pos, ready.meter, ready.subdivision);
  }
  return events;
}
