import { mod } from "../shared/pitch.js";
import { parseChord } from "../shared/theory.js";
import { Note } from "../vendor/tonal/tonal.js";
import { bestNextVoicing, voicingsFor } from "./voicings.js";

function guideSlots(chord) {
  const third = chord.tones.find((t) => t.interval === "3M" || t.interval === "3m" || t.interval === "4P");
  const seventh = chord.tones.find((t) => t.interval === "7M" || t.interval === "7m" || t.interval === "7d");
  return { third, seventh };
}

function nearestMidi(prev, pc) {
  let best = null;
  for (let midi = prev - 7; midi <= prev + 7; midi += 1) {
    if (mod(midi, 12) !== pc) continue;
    const distance = Math.abs(midi - prev);
    if (!best || distance < best.distance) best = { midi, distance };
  }
  return best ? best.midi : prev;
}

function placeFirst(third, seventh) {
  const candidates = [];
  const bases = (tone) => {
    const base = 60 + tone.pc;
    return [base - 12, base, base + 12];
  };
  if (third && seventh) {
    for (const tm of bases(third)) {
      for (const sm of bases(seventh)) {
        if (tm < 55 || tm > 82 || sm < 55 || sm > 82 || tm === sm) continue;
        const span = Math.abs(tm - sm);
        if (span < 3 || span > 10) continue;
        candidates.push({ third: tm, seventh: sm, span });
      }
    }
    candidates.sort((a, b) => a.span - b.span || Math.min(a.third, a.seventh) - Math.min(b.third, b.seventh));
    if (candidates.length) return candidates[0];
  }
  const only = third || seventh;
  if (!only) return null;
  return { third: third ? 60 + third.pc : null, seventh: seventh ? 60 + seventh.pc : null, span: 0 };
}

function stepPair(prevThird, prevSeventh, chord) {
  const { third, seventh } = guideSlots(chord);
  const options = [third, seventh].filter(Boolean);
  if (!options.length) return { third: null, seventh: null };
  if (options.length === 1 || prevSeventh == null || prevThird == null) {
    const target = options[0];
    const from = prevThird ?? prevSeventh;
    const midi = nearestMidi(from, target.pc);
    return {
      third: third ? { ...third, midi } : null,
      seventh: !third && seventh ? { ...seventh, midi } : third && seventh ? { ...seventh, midi: nearestMidi(prevSeventh ?? from, seventh.pc) } : null,
    };
  }
  let best = null;
  for (const swap of [false, true]) {
    const toThird = swap ? seventh : third;
    const toSeventh = swap ? third : seventh;
    const midiThird = nearestMidi(prevThird, toThird.pc);
    const midiSeventh = nearestMidi(prevSeventh, toSeventh.pc);
    let cost = Math.abs(midiThird - prevThird) + Math.abs(midiSeventh - prevSeventh);
    if (midiThird === midiSeventh) cost += 12;
    if (!best || cost < best.cost) {
      best = {
        cost,
        third: { ...toThird, midi: midiThird },
        seventh: { ...toSeventh, midi: midiSeventh },
      };
    }
  }
  return best;
}

export function guideToneLines(chords) {
  const parsed = chords.map((chord) => (typeof chord === "string" ? parseChord(chord) : chord)).filter((c) => c && !c.empty);
  if (parsed.length < 2) return [];
  const first = guideSlots(parsed[0]);
  const placed = placeFirst(first.third, first.seventh);
  if (!placed) return [];
  const lineThird = [];
  const lineSeventh = [];
  if (first.third && placed.third != null) lineThird.push({ ...first.third, midi: placed.third });
  if (first.seventh && placed.seventh != null) lineSeventh.push({ ...first.seventh, midi: placed.seventh });
  let prevThird = placed.third;
  let prevSeventh = placed.seventh;
  for (let i = 1; i < parsed.length; i += 1) {
    const next = stepPair(prevThird, prevSeventh, parsed[i]);
    if (next.third) lineThird.push(next.third);
    if (next.seventh) lineSeventh.push(next.seventh);
    prevThird = next.third?.midi ?? prevThird;
    prevSeventh = next.seventh?.midi ?? prevSeventh;
  }
  return [lineThird, lineSeventh]
    .filter((line) => line.length >= 2)
    .map((line) =>
      line.map((tone) => ({
        name: tone.display,
        label: tone.label,
        midi: tone.midi,
        pc: tone.pc,
      })),
    );
}

export function commonToneNames(chordA, chordB) {
  const a = typeof chordA === "string" ? parseChord(chordA) : chordA;
  const b = typeof chordB === "string" ? parseChord(chordB) : chordB;
  const seen = new Set();
  const out = [];
  for (const tone of a.tones) {
    if (seen.has(tone.pc)) continue;
    const other = b.tones.find((t) => t.pc === tone.pc);
    if (!other) continue;
    seen.add(tone.pc);
    out.push({ note: tone.display, labelA: tone.label, labelB: other.label, pc: tone.pc });
  }
  return out;
}

export function progressionFor(tonic, kind) {
  const root = Note.pitchClass(tonic);
  if (!root) return [];
  if (kind === "251" || kind === "ii-V-I") {
    return [`${Note.transpose(root, "2M")}m7`, `${Note.transpose(root, "5P")}7`, `${root}maj7`];
  }
  if (kind === "cadence" || kind === "V7-I") {
    return [`${root}7`, `${Note.transpose(root, "4P")}maj7`];
  }
  if (kind === "iv" || kind === "IV-iv") {
    const iv = Note.transpose(root, "4P");
    return [iv, `${iv}m`];
  }
  return [];
}

export function voiceLeadProgression(symbols, startVoicing = null) {
  const chords = symbols.map((symbol) => parseChord(symbol)).filter((c) => !c.empty);
  if (!chords.length) return [];
  const path = [];
  let current = startVoicing || voicingsFor(chords[0])[0] || null;
  path.push({ chord: chords[0], voicing: current, movement: 0 });
  for (let i = 1; i < chords.length; i += 1) {
    const next = bestNextVoicing(current, chords[i]);
    path.push({ chord: chords[i], voicing: next, movement: next?.movement ?? null });
    current = next;
  }
  return path;
}
