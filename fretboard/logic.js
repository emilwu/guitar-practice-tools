/** Pure fretboard-trainer rules: pitches, intervals, CAGED boxes, questions, grading. */
import { DEGREE_LABELS, pentatonicBox } from "../shared/boxes.js";
import { midiAt, mod, pcAt } from "../shared/pitch.js";

export const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
export const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11];

const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** One button per semitone. Aliases are accepted when grading a typed or clicked label. */
export const INTERVALS = [
  { semitones: 0, label: "R", aliases: ["R", "1", "P1"] },
  { semitones: 1, label: "b2", aliases: ["b2", "b9"] },
  { semitones: 2, label: "2", aliases: ["2", "9"] },
  { semitones: 3, label: "b3", aliases: ["b3", "#2"] },
  { semitones: 4, label: "3", aliases: ["3"] },
  { semitones: 5, label: "4", aliases: ["4", "11"] },
  { semitones: 6, label: "b5", aliases: ["b5", "#4", "#11"] },
  { semitones: 7, label: "5", aliases: ["5"] },
  { semitones: 8, label: "#5", aliases: ["#5", "b6", "b13"] },
  { semitones: 9, label: "6", aliases: ["6", "13"] },
  { semitones: 10, label: "b7", aliases: ["b7"] },
  { semitones: 11, label: "7", aliases: ["7"] },
];

const DEGREE_ALIAS = {
  "1": "R",
  P1: "R",
  b9: "b2",
  "9": "2",
  "#2": "b3",
  "11": "4",
  "#4": "b5",
  "#11": "b5",
  b6: "#5",
  b13: "#5",
  "13": "6",
};

export const CANONICAL_DEGREES = INTERVALS.map((item) => item.label);

export const SCALES = [
  { id: "major", name: "大調", pcs: [0, 2, 4, 5, 7, 9, 11] },
  { id: "minor", name: "自然小調", pcs: [0, 2, 3, 5, 7, 8, 10] },
  { id: "maj-pent", name: "大調五聲", pcs: [0, 2, 4, 7, 9] },
  { id: "min-pent", name: "小調五聲", pcs: [0, 3, 5, 7, 10] },
  { id: "blues", name: "藍調", pcs: [0, 3, 5, 6, 7, 10] },
];

/** CAGED order used as 第 1–5 框. E is box 1, root on the 6th string for pentatonic. */
export const SHAPES = [
  { id: "E", box: 1, name: "E 型" },
  { id: "D", box: 2, name: "D 型" },
  { id: "C", box: 3, name: "C 型" },
  { id: "A", box: 4, name: "A 型" },
  { id: "G", box: 5, name: "G 型" },
];

/** Fret window relative to the shape's root fret. Span stays inside 4 frets. */
const WINDOWS = {
  E: { rootStringIndex: 0, min: 0, max: 4 },
  D: { rootStringIndex: 2, min: -1, max: 3 },
  C: { rootStringIndex: 1, min: -3, max: 1 },
  A: { rootStringIndex: 1, min: 0, max: 4 },
  G: { rootStringIndex: 0, min: -3, max: 1 },
};

const SCALE_ALIAS = {
  major: "major",
  ionian: "major",
  minor: "minor",
  "natural-minor": "minor",
  aeolian: "minor",
  "maj-pent": "maj-pent",
  "major-pentatonic": "maj-pent",
  "pentatonic-major": "maj-pent",
  "min-pent": "min-pent",
  "minor-pentatonic": "min-pent",
  "pentatonic-minor": "min-pent",
  blues: "blues",
};

const MAX_FRET = 15;

export function noteName(pc, spell = "sharp") {
  const names = spell === "flat" ? FLAT_NAMES : SHARP_NAMES;
  return names[mod(pc, 12)];
}

export function namesForPc(pc) {
  const sharp = SHARP_NAMES[mod(pc, 12)];
  const flat = FLAT_NAMES[mod(pc, 12)];
  return sharp === flat ? [sharp] : [sharp, flat];
}

export function pcFromName(name) {
  const cleaned = String(name ?? "")
    .trim()
    .replace(/♭/g, "b")
    .replace(/♯/g, "#");
  const match = cleaned.match(/^([A-Ga-g])(#{1,2}|b{1,2})?$/);
  if (!match) return null;
  const base = NATURAL[match[1].toUpperCase()];
  const acc = match[2] || "";
  const delta = acc.startsWith("#") ? acc.length : acc.startsWith("b") ? -acc.length : 0;
  return mod(base + delta, 12);
}

export function gradeName(pc, name) {
  const found = pcFromName(name);
  return found != null && found === mod(pc, 12);
}

export function pitchAt(stringIndex, fret, spell = "sharp") {
  const pc = pcAt(stringIndex, fret);
  return {
    string: 6 - stringIndex,
    stringIndex,
    fret,
    pc,
    midi: midiAt(stringIndex, fret),
    name: noteName(pc, spell),
    names: namesForPc(pc),
  };
}

export function positionsInRange({ strings, fretMin, fretMax, pcs = null }) {
  const wanted = pcs ? new Set(pcs) : null;
  const enabled = [...new Set(strings || [])].filter((string) => string >= 1 && string <= 6);
  const low = Math.min(fretMin, fretMax);
  const high = Math.max(fretMin, fretMax);
  const positions = [];
  for (const string of enabled.sort((a, b) => b - a)) {
    const stringIndex = 6 - string;
    for (let fret = low; fret <= high; fret += 1) {
      if (fret < 0 || fret > MAX_FRET) continue;
      const pitch = pitchAt(stringIndex, fret);
      if (wanted && !wanted.has(pitch.pc)) continue;
      positions.push(pitch);
    }
  }
  return positions;
}

export function intervalFromSemitones(semitones) {
  const semi = mod(semitones, 12);
  return INTERVALS[semi];
}

export function intervalBetween(from, to) {
  return intervalFromSemitones(to.pc - from.pc);
}

export function canonicalDegree(label) {
  const token = String(label ?? "").trim();
  if (CANONICAL_DEGREES.includes(token)) return token;
  return DEGREE_ALIAS[token] || null;
}

export function gradeInterval(semitones, label) {
  const info = intervalFromSemitones(semitones);
  const token = String(label ?? "").trim();
  return info.aliases.includes(token) || info.label === token;
}

export function scaleById(id) {
  const canonical = SCALE_ALIAS[id] || id;
  return SCALES.find((scale) => scale.id === canonical) || null;
}

export function shapeById(id) {
  const token = String(id || "E").toUpperCase();
  return SHAPES.find((shape) => shape.id === token) || SHAPES[0];
}

function withMidi(position, keyPc) {
  const semi = mod(position.pc - keyPc, 12);
  return {
    string: position.string,
    stringIndex: position.stringIndex,
    fret: position.fret,
    pc: position.pc,
    midi: midiAt(position.stringIndex, position.fret),
    degree: position.label || DEGREE_LABELS[semi],
  };
}

function shiftPositions(positions, delta) {
  return positions.map((position) => ({
    ...position,
    fret: position.fret + delta,
    midi: position.midi + delta,
  }));
}

function fitsNeck(positions) {
  return positions.length > 0 && positions.every((position) => position.fret >= 0 && position.fret <= MAX_FRET);
}

function chooseOctave(positions, fretMin, fretMax) {
  const candidates = [];
  for (const delta of [0, 12, -12]) {
    const shifted = delta === 0 ? positions : shiftPositions(positions, delta);
    if (fitsNeck(shifted)) candidates.push(shifted);
  }
  if (!candidates.length) {
    const clipped = positions.filter((position) => position.fret >= 0 && position.fret <= MAX_FRET);
    if (clipped.length) candidates.push(clipped);
  }
  function score(list) {
    const inside = list.filter((position) => position.fret >= fretMin && position.fret <= fretMax).length;
    const overflow = list.length - inside;
    return inside * 10 - overflow;
  }
  candidates.sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff) return diff;
    return Math.min(...a.map((position) => position.fret)) - Math.min(...b.map((position) => position.fret));
  });
  return candidates[0] || [];
}

function addBlueNotes(positions, keyPc) {
  const blue = mod(keyPc + 6, 12);
  const minF = Math.min(...positions.map((position) => position.fret));
  const maxF = Math.max(...positions.map((position) => position.fret));
  const have = new Set(positions.map((position) => `${position.stringIndex}:${position.fret}`));
  const extra = [];
  for (let stringIndex = 0; stringIndex < 6; stringIndex += 1) {
    for (let fret = minF; fret <= maxF; fret += 1) {
      if (fret < 0 || pcAt(stringIndex, fret) !== blue) continue;
      const key = `${stringIndex}:${fret}`;
      if (have.has(key)) continue;
      have.add(key);
      extra.push(withMidi({ string: 6 - stringIndex, stringIndex, fret, pc: blue, label: "b5" }, keyPc));
    }
  }
  return positions.concat(extra);
}

function diatonicBox(keyPc, scale, shape) {
  const spec = WINDOWS[shape.id];
  const base = mod(keyPc - pcAt(spec.rootStringIndex, 0), 12);
  const anchors = [];
  for (let rootFret = base; rootFret <= MAX_FRET; rootFret += 12) {
    if (rootFret + spec.min < 0) continue;
    if (rootFret + spec.max > MAX_FRET) continue;
    anchors.push(rootFret);
  }
  const rootFret = anchors[0];
  if (rootFret == null) return [];
  const positions = [];
  for (let stringIndex = 0; stringIndex < 6; stringIndex += 1) {
    for (let offset = spec.min; offset <= spec.max; offset += 1) {
      const fret = rootFret + offset;
      const pc = pcAt(stringIndex, fret);
      if (!scale.pcs.includes(mod(pc - keyPc, 12))) continue;
      positions.push(withMidi({ string: 6 - stringIndex, stringIndex, fret, pc }, keyPc));
    }
  }
  return positions;
}

function primaryRoot(positions, shape, keyPc) {
  const prefer = WINDOWS[shape.id].rootStringIndex;
  const roots = positions.filter((position) => position.pc === keyPc);
  return roots.find((position) => position.stringIndex === prefer) || roots[0] || null;
}

export function scaleBox({ key, scale, shape, strings, fretMin = 0, fretMax = 12 }) {
  const keyPc = typeof key === "number" ? mod(key, 12) : pcFromName(key);
  const scaleInfo = typeof scale === "string" ? scaleById(scale) : scale;
  const shapeInfo = typeof shape === "string" ? shapeById(shape) : shape || SHAPES[0];
  if (keyPc == null || !scaleInfo || !shapeInfo) return null;
  const enabled = [...new Set(strings || [])].filter((string) => string >= 1 && string <= 6);
  if (!enabled.length) return null;
  const low = Math.max(0, Math.min(fretMin, fretMax));
  const high = Math.min(MAX_FRET, Math.max(fretMin, fretMax));

  let positions;
  if (scaleInfo.id === "maj-pent" || scaleInfo.id === "min-pent" || scaleInfo.id === "blues") {
    const kind = scaleInfo.id === "maj-pent" ? "major" : "minor";
    const box = pentatonicBox(keyPc, kind, shapeInfo.box);
    positions = box.positions.map((position) => withMidi(position, keyPc));
    if (scaleInfo.id === "blues") positions = addBlueNotes(positions, keyPc);
  } else {
    positions = diatonicBox(keyPc, scaleInfo, shapeInfo);
  }
  if (!positions.length) return null;
  positions = chooseOctave(positions, low, high).filter((position) => enabled.includes(position.string));
  if (!positions.length) return null;

  const spanMin = Math.min(...positions.map((position) => position.fret));
  const spanMax = Math.max(...positions.map((position) => position.fret));
  const root = primaryRoot(positions, shapeInfo, keyPc);
  return {
    key: noteName(keyPc, "sharp"),
    keyPc,
    scale: scaleInfo.id,
    scaleName: scaleInfo.name,
    shape: shapeInfo.id,
    shapeName: shapeInfo.name,
    box: shapeInfo.box,
    strings: enabled.sort((a, b) => b - a),
    root,
    fretMin: spanMin,
    fretMax: spanMax,
    fitsRange: positions.every((position) => position.fret >= low && position.fret <= high),
    positions,
  };
}

function shuffle(list, rng) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function rangeOf(settings) {
  return {
    strings: settings.strings,
    fretMin: settings.fretMin,
    fretMax: settings.fretMax,
  };
}

function allowedCells(settings) {
  return positionsInRange(rangeOf(settings)).filter((cell) => !settings.naturals || NATURAL_PCS.includes(cell.pc));
}

export function gradeTaps(targets, taps) {
  const key = (position) => `${position.stringIndex}:${position.fret}`;
  const targetSet = new Set((targets || []).map(key));
  const correctKeys = new Set();
  const wrongKeys = new Set();
  for (const tap of taps || []) {
    const id = key(tap);
    if (targetSet.has(id)) correctKeys.add(id);
    else wrongKeys.add(id);
  }
  const missed = [...targetSet].filter((id) => !correctKeys.has(id));
  const correct = correctKeys.size;
  const wrong = wrongKeys.size;
  const total = correct + wrong + missed.length;
  return {
    correct,
    wrong,
    missed: missed.length,
    foundAll: missed.length === 0 && targetSet.size > 0,
    clean: missed.length === 0 && wrong === 0 && targetSet.size > 0,
    accuracy: total ? correct / total : 1,
  };
}

export function makeQuestion(settings, rng = Math.random) {
  if (settings.mode === "scale") return makeScaleQuestion(settings);
  if (settings.mode === "name") return makeNameQuestion(settings, rng);
  if (settings.mode === "interval" && settings.imode === "name") return makeIntervalNameQuestion(settings, rng);
  if (settings.mode === "interval") return makeLocateQuestion(settings, rng);
  return makeFindQuestion(settings, rng);
}

function makeFindQuestion(settings, rng) {
  const pcs = settings.naturals ? NATURAL_PCS.slice() : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  for (const pc of shuffle(pcs, rng)) {
    const targets = positionsInRange({ ...rangeOf(settings), pcs: [pc] });
    if (!targets.length) continue;
    return { type: "find", pc, targets, cells: positionsInRange(rangeOf(settings)) };
  }
  return null;
}

function makeNameQuestion(settings, rng) {
  const cells = allowedCells(settings);
  if (!cells.length) return null;
  const position = cells[Math.min(cells.length - 1, Math.floor(rng() * cells.length))];
  return { type: "name", pc: position.pc, position, targets: [position], cells: [position] };
}

function degreePool(settings) {
  const pool = (settings.degrees || []).map(canonicalDegree).filter(Boolean);
  return pool.length ? [...new Set(pool)] : CANONICAL_DEGREES.slice();
}

function makeLocateQuestion(settings, rng) {
  const cells = allowedCells(settings);
  const degrees = degreePool(settings);
  if (!cells.length || !degrees.length) return null;
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const root = cells[Math.min(cells.length - 1, Math.floor(rng() * cells.length))];
    const degree = degrees[Math.min(degrees.length - 1, Math.floor(rng() * degrees.length))];
    const info = INTERVALS.find((item) => item.label === degree);
    if (!info) continue;
    const semitones = info.semitones;
    const pc = mod(root.pc + semitones, 12);
    const targets = positionsInRange({ ...rangeOf(settings), pcs: [pc] }).filter(
      (position) => !(position.stringIndex === root.stringIndex && position.fret === root.fret),
    );
    if (!targets.length) continue;
    return {
      type: "locate",
      pc,
      degree,
      semitones,
      root,
      targets,
      cells: positionsInRange(rangeOf(settings)),
    };
  }
  return null;
}

function makeIntervalNameQuestion(settings, rng) {
  const cells = allowedCells(settings);
  const degrees = new Set(degreePool(settings));
  if (cells.length < 2) return null;
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const a = cells[Math.min(cells.length - 1, Math.floor(rng() * cells.length))];
    const b = cells[Math.min(cells.length - 1, Math.floor(rng() * cells.length))];
    if (a.stringIndex === b.stringIndex && a.fret === b.fret) continue;
    const lower = a.midi <= b.midi ? a : b;
    const higher = lower === a ? b : a;
    const semitones = mod(higher.pc - lower.pc, 12);
    if (semitones === 0) continue;
    const info = intervalFromSemitones(semitones);
    if (!degrees.has(info.label)) continue;
    return {
      type: "iname",
      pc: higher.pc,
      degree: info.label,
      semitones,
      root: lower,
      other: higher,
      targets: [],
      cells: [lower, higher],
    };
  }
  return null;
}

function makeScaleQuestion(settings) {
  const keyPc = pcFromName(settings.key);
  const scale = scaleById(settings.scale);
  if (keyPc == null || !scale) return null;
  if (settings.naturals && !NATURAL_PCS.includes(keyPc)) return null;
  const box = scaleBox({
    key: keyPc,
    scale: scale.id,
    shape: settings.shape,
    strings: settings.strings,
    fretMin: settings.fretMin,
    fretMax: settings.fretMax,
  });
  if (!box) return null;
  const cells = [];
  for (const string of box.strings) {
    for (let fret = box.fretMin; fret <= box.fretMax; fret += 1) {
      cells.push(pitchAt(6 - string, fret));
    }
  }
  return { type: "scale", pc: box.keyPc, box, targets: box.positions, cells };
}
