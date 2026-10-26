import { OPEN_PC, midiAt, mod, pcAt } from "../shared/pitch.js";
import { requiredPcs, triadMembers } from "../shared/theory.js";
import { CHORDS } from "../vendor/chords-db/guitar.js";

const DB_KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

const SUFFIX = {
  "1P,3M,5P": "major",
  "1P,3m,5P": "minor",
  "1P,3m,5d": "dim",
  "1P,3m,5d,7d": "dim7",
  "1P,2M,5P": "sus2",
  "1P,4P,5P": "sus4",
  "1P,4P,5P,7m": "7sus4",
  "1P,3M,5A": "aug",
  "1P,3M,5P,6M": "6",
  "1P,3M,5P,6M,9M": "69",
  "1P,3M,5P,7m": "7",
  "1P,3M,5d,7m": "7b5",
  "1P,3M,5A,7m": "aug7",
  "1P,3M,5P,7m,9M": "9",
  "1P,3M,5d,7m,9M": "9b5",
  "1P,3M,5A,7m,9M": "aug9",
  "1P,3M,5P,7m,9m": "7b9",
  "1P,3M,5P,7m,9A": "7#9",
  "1P,3M,5P,7m,9M,11P": "11",
  "1P,3M,5P,7m,9M,11A": "9#11",
  "1P,3M,5P,7m,9M,13M": "13",
  "1P,3M,5P,7M": "maj7",
  "1P,3M,5d,7M": "maj7b5",
  "1P,3M,5A,7M": "maj7#5",
  "1P,3M,5P,7M,9M": "maj9",
  "1P,3m,5P,6M": "m6",
  "1P,3m,5P,6M,9M": "m69",
  "1P,3m,5P,7m": "m7",
  "1P,3m,5d,7m": "m7b5",
  "1P,3m,5P,7m,9M": "m9",
  "1P,3m,5P,7m,9M,11P": "m11",
  "1P,3m,5P,7M": "mmaj7",
  "1P,3m,5P,7M,9M": "mmaj9",
  "1P,3M,5P,9M": "add9",
  "1P,3m,5P,9M": "madd9",
  "1P,3M,5A,7m,9A": "alt",
};

const E_PREFER = [
  { 0: 100 },
  { 7: 50, 6: 45, 8: 44, 5: 18 },
  { 10: 48, 11: 48, 9: 44, 0: 36, 2: 30 },
  { 4: 54, 3: 50, 5: 46, 10: 20, 11: 20 },
  { 4: 40, 3: 40, 5: 36, 7: 34, 6: 32, 0: 18, 10: 16, 2: 14 },
  { 0: 36, 2: 34, 3: 32, 4: 22, 7: 14, 10: 12 },
];

const A_PREFER = [
  null,
  { 0: 100 },
  { 7: 50, 6: 46, 8: 44, 5: 16 },
  { 10: 48, 11: 48, 9: 40, 0: 32 },
  { 4: 54, 3: 50, 5: 46, 2: 28 },
  { 7: 30, 10: 26, 0: 18, 4: 16, 3: 16, 8: 14 },
];

export function fretSpan(frets) {
  const sounded = frets.filter((f) => typeof f === "number" && f > 0);
  if (!sounded.length) return 1;
  return Math.max(...sounded) - Math.min(...sounded) + 1;
}

export function fingerCount(frets) {
  const played = frets.map((f, s) => ({ s, f })).filter((x) => typeof x.f === "number" && x.f > 0);
  if (!played.length) return 0;
  const min = Math.min(...played.map((p) => p.f));
  const atMin = played.filter((p) => p.f === min);
  const consumed = new Set();
  let fingers = 0;
  if (atMin.length >= 2) {
    fingers += 1;
    atMin.forEach((p) => consumed.add(p.s));
  }
  const rest = played.filter((p) => !consumed.has(p.s));
  const by = new Map();
  for (const p of rest) {
    if (!by.has(p.f)) by.set(p.f, []);
    by.get(p.f).push(p.s);
  }
  for (const group of by.values()) {
    group.sort((a, b) => a - b);
    let runs = 1;
    for (let i = 1; i < group.length; i += 1) if (group[i] !== group[i - 1] + 1) runs += 1;
    fingers += runs;
  }
  return fingers;
}

function detectBarres(frets) {
  const played = frets.map((f, s) => ({ s, f })).filter((x) => x.f > 0);
  if (played.length < 2) return [];
  const min = Math.min(...played.map((p) => p.f));
  const count = played.filter((p) => p.f === min).length;
  return count >= 2 ? [min] : [];
}

function corePcs(chord) {
  const iv = new Map(chord.tones.map((t) => [t.interval, t.pc]));
  const need = [];
  if (iv.has("1P")) need.push(iv.get("1P"));
  if (iv.has("3M")) need.push(iv.get("3M"));
  else if (iv.has("3m")) need.push(iv.get("3m"));
  else if (iv.has("4P")) need.push(iv.get("4P"));
  else if (iv.has("2M")) need.push(iv.get("2M"));
  if (iv.has("7d")) need.push(iv.get("7d"));
  else if (iv.has("7m")) need.push(iv.get("7m"));
  else if (iv.has("7M")) need.push(iv.get("7M"));
  return [...new Set(need)];
}

function notesFor(frets, chord) {
  const byPc = new Map();
  for (const tone of chord.tones) if (!byPc.has(tone.pc)) byPc.set(tone.pc, tone);
  const notes = [];
  frets.forEach((fret, stringIndex) => {
    if (fret === null || fret === undefined) return;
    const pc = pcAt(stringIndex, fret);
    const tone = byPc.get(pc);
    notes.push({
      string: 6 - stringIndex,
      stringIndex,
      fret,
      midi: midiAt(stringIndex, fret),
      pc,
      name: tone?.display || "?",
      label: tone?.label || "?",
    });
  });
  return notes;
}

function acceptable(frets, chord, relax = false) {
  const notes = notesFor(frets, chord);
  if (notes.length < 3) return null;
  if (notes.some((n) => n.label === "?")) return null;
  if (fretSpan(frets) > 4) return null;
  if (fingerCount(frets) > 4) return null;
  if (notes.some((n) => n.fret > 15)) return null;
  const have = new Set(notes.map((n) => n.pc));
  const need = relax ? corePcs(chord) : requiredPcs(chord);
  if (!need.every((pc) => have.has(pc))) return null;
  return notes;
}

function makeVoicing(chord, source, label, frets, fingers = null, relax = false) {
  const notes = acceptable(frets, chord, relax);
  if (!notes) return null;
  const barres = detectBarres(frets);
  const id = `${source}-${frets.map((f) => (f === null ? "x" : String(f))).join(".")}`;
  return {
    id,
    source,
    label,
    frets: frets.slice(),
    fingers: fingers || inferFingers(frets, barres),
    barres,
    notes,
  };
}

function inferFingers(frets, barres) {
  const fingers = frets.map((f) => (f > 0 ? 0 : 0));
  const barre = new Set(barres);
  let next = 1;
  if (barre.size) {
    frets.forEach((f, i) => {
      if (barre.has(f)) fingers[i] = 1;
    });
    next = 2;
  }
  const pending = [];
  frets.forEach((f, i) => {
    if (f > 0 && !fingers[i]) pending.push(i);
  });
  pending.sort((a, b) => frets[a] - frets[b] || a - b);
  for (const i of pending) {
    const share = pending.find((j) => fingers[j] && frets[j] === frets[i] && Math.abs(j - i) === 1);
    if (share) fingers[i] = fingers[share];
    else if (next <= 4) fingers[i] = next++;
    else fingers[i] = 0;
  }
  return fingers;
}

function shapeFromPrefer(chord, rootString, rootFret, prefer, source, label) {
  const offsets = prefer.map(() => null);
  offsets[rootString] = 0;
  for (let s = 0; s < 6; s += 1) {
    if (s === rootString || !prefer[s]) continue;
    let best = null;
    for (let d = 0; d <= 3; d += 1) {
      const pc = pcAt(s, rootFret + d);
      if (!chord.pcs.includes(pc)) continue;
      const iv = mod(pc - chord.rootPc, 12);
      const score = prefer[s][iv] ?? 12;
      if (!best || score > best.score) best = { d, score };
    }
    if (best) offsets[s] = best.d;
  }
  forceRequired(chord, rootString, rootFret, offsets);
  const frets = offsets.map((d, s) => {
    if (d === null) return null;
    if (!prefer[s] && s !== rootString) return null;
    return rootFret + d;
  });
  frets[rootString] = rootFret;
  if (rootString === 1) frets[0] = null;
  return makeVoicing(chord, source, label, frets);
}

function forceRequired(chord, rootString, rootFret, offsets) {
  const present = () => {
    const set = new Set();
    offsets.forEach((d, s) => {
      if (d === null) return;
      set.add(pcAt(s, rootFret + d));
    });
    return set;
  };
  const have = present();
  for (const pc of requiredPcs(chord)) {
    if (have.has(pc)) continue;
    let choice = null;
    for (let s = 5; s >= 0; s -= 1) {
      if (s === rootString) continue;
      for (let d = 0; d <= 3; d += 1) {
        if (pcAt(s, rootFret + d) !== pc) continue;
        const current = offsets[s] === null ? null : pcAt(s, rootFret + offsets[s]);
        const duplicated =
          current !== null &&
          offsets.filter((od, os) => od !== null && pcAt(os, rootFret + od) === current).length >= 2;
        const requiredNow = current !== null && requiredPcs(chord).includes(current);
        if (requiredNow && !duplicated) continue;
        const score = (duplicated ? 5 : 0) + (offsets[s] === null ? 1 : 0) + (s === 5 ? 1 : 0);
        if (!choice || score > choice.score) choice = { s, d, score };
      }
    }
    if (choice) {
      offsets[choice.s] = choice.d;
      have.add(pc);
    }
  }
}

function rootFrets(stringIndex, rootPc, max = 12) {
  const out = [];
  for (let f = 0; f <= max; f += 1) if (pcAt(stringIndex, f) === rootPc) out.push(f);
  return out;
}

function movableShapes(chord) {
  const out = [];
  for (const fret of rootFrets(0, chord.rootPc, 12)) {
    const label = fret === 0 ? "E 型（開放）" : "E 型封閉";
    const voicing = shapeFromPrefer(chord, 0, fret, E_PREFER, "barre-e", label);
    if (voicing) out.push(voicing);
  }
  for (const fret of rootFrets(1, chord.rootPc, 12)) {
    const label = fret === 0 ? "A 型（開放）" : "A 型封閉";
    const voicing = shapeFromPrefer(chord, 1, fret, A_PREFER, "barre-a", label);
    if (voicing) out.push(voicing);
  }
  return out;
}

function nearestFret(stringIndex, pc, anchor) {
  let best = null;
  for (let f = Math.max(0, anchor - 3); f <= Math.min(15, anchor + 3); f += 1) {
    if (pcAt(stringIndex, f) !== pc) continue;
    const d = Math.abs(f - anchor);
    if (!best || d < best.d) best = { f, d };
  }
  return best ? best.f : null;
}

function shellVoicings(chord) {
  const third = chord.tones.find((t) => t.interval === "3M" || t.interval === "3m" || t.interval === "4P");
  const seventh = chord.tones.find((t) => t.interval === "7M" || t.interval === "7m" || t.interval === "7d");
  if (!third || !seventh) return [];
  const patterns = [
    { order: "R-3-7", gaps: [0, 1, 2], roles: ["root", "third", "seventh"] },
    { order: "R-7-3", gaps: [0, 2, 3], roles: ["root", "seventh", "third"] },
  ];
  const out = [];
  for (const rootString of [0, 1]) {
    for (const base of rootFrets(rootString, chord.rootPc, 12)) {
      for (const pattern of patterns) {
        const strings = pattern.gaps.map((g) => rootString + g);
        if (strings.some((s) => s > 5)) continue;
        const frets = [null, null, null, null, null, null];
        const pcs = { root: chord.rootPc, third: third.pc, seventh: seventh.pc };
        let ok = true;
        strings.forEach((s, i) => {
          const role = pattern.roles[i];
          const fret = role === "root" ? base : nearestFret(s, pcs[role], base);
          if (fret === null) ok = false;
          else frets[s] = fret;
        });
        if (!ok) continue;
        const bass = rootString === 0 ? "6弦根音" : "5弦根音";
        const voicing = makeVoicing(chord, "shell", `shell voicing ${pattern.order} · ${bass}`, frets, null, true);
        if (voicing) out.push(voicing);
      }
    }
  }
  return out;
}

function drop2Members(chord) {
  const by = new Map(chord.tones.map((t) => [t.interval, t]));
  const root = by.get("1P");
  const third = by.get("3M") || by.get("3m") || by.get("4P") || by.get("2M");
  const seventh = by.get("7M") || by.get("7m") || by.get("7d");
  const ninth = by.get("9M") || by.get("9m") || by.get("9A");
  const fifth = by.get("5P") || by.get("5d") || by.get("5A");
  const sixth = by.get("13M") || by.get("6M");
  const pack = (tones) =>
    tones
      .filter(Boolean)
      .map((tone, index) => ({
        pc: tone.pc,
        label: tone.label,
        semi: tone.semitones,
      }))
      .sort((a, b) => a.semi - b.semi);
  if (root && third && seventh && (ninth || sixth)) return pack([root, third, seventh, ninth || sixth]);
  if (root && third && seventh && fifth) return pack([root, third, fifth, seventh]);
  if (root && third && fifth) return pack([root, third, fifth, { ...root, semitones: 12 }]);
  if (root && third && seventh) return pack([root, third, seventh, { ...root, semitones: 12 }]);
  return null;
}

function drop2Voicings(chord) {
  const members = drop2Members(chord);
  if (!members || members.length < 4) return [];
  const strings = [2, 3, 4, 5];
  const out = [];
  for (let inv = 0; inv < 4; inv += 1) {
    const close = [0, 1, 2, 3].map((k) => members[(inv + k) % 4]);
    const voices = [close[2], close[0], close[1], close[3]];
    for (let base = 0; base <= 12; base += 1) {
      const frets = [null, null, null, null, null, null];
      let prev = -1;
      let ok = true;
      for (let i = 0; i < 4; i += 1) {
        let found = null;
        for (let fret = base; fret <= base + 3; fret += 1) {
          const midi = midiAt(strings[i], fret);
          if (mod(midi, 12) === voices[i].pc && midi > prev) {
            found = { fret, midi };
            break;
          }
        }
        if (!found) {
          ok = false;
          break;
        }
        prev = found.midi;
        frets[strings[i]] = found.fret;
      }
      if (!ok) continue;
      const voicing = makeVoicing(chord, "drop2", "Drop 2 · 上四弦", frets);
      if (voicing) out.push(voicing);
    }
  }
  return out;
}

function databaseVoicings(chord) {
  const key = DB_KEYS[chord.rootPc];
  const suffix = SUFFIX[chord.intervals.join(",")];
  const positions = suffix ? CHORDS[key]?.[suffix] : null;
  if (!positions) return [];
  const out = [];
  positions.forEach((pos, index) => {
    const openish = pos.frets.some((f) => f === 0) && fretSpan(pos.frets) <= 4;
    const min = Math.min(...pos.frets.filter((f) => f > 0), 99);
    const label = openish ? "常用開放按法" : min <= 1 ? "常用按法" : `常用按法 · 第 ${min} 格`;
    const voicing = makeVoicing(chord, "chords-db", label, pos.frets, pos.fingers);
    if (voicing) out.push({ ...voicing, order: index });
  });
  return out;
}

function dedupe(list) {
  const map = new Map();
  for (const voicing of list) {
    const key = voicing.frets.map((f) => (f === null ? "x" : f)).join(",");
    const prev = map.get(key);
    if (!prev) {
      map.set(key, voicing);
      continue;
    }
    // Same grip from the database and a named shape: keep the shape name, keep database fingers.
    if (prev.source === "chords-db" && voicing.source !== "chords-db") {
      const fingers = prev.fingers?.some((f) => f > 0) ? prev.fingers : voicing.fingers;
      map.set(key, { ...voicing, fingers });
    }
  }
  return [...map.values()];
}

export function allVoicings(chord) {
  if (!chord || chord.empty) return [];
  const list = dedupe([
    ...databaseVoicings(chord),
    ...movableShapes(chord),
    ...shellVoicings(chord),
    ...drop2Voicings(chord),
  ]);
  list.sort((a, b) => {
    const af = Math.min(...a.frets.filter((f) => f > 0), 0);
    const bf = Math.min(...b.frets.filter((f) => f > 0), 0);
    return af - bf;
  });
  return list;
}

const PICK_ORDER = ["chords-db", "barre-e", "barre-a", "shell", "drop2", "chords-db", "shell", "drop2", "barre-e", "barre-a"];

export function voicingsFor(chord, limit = 6) {
  const all = allVoicings(chord);
  const chosen = [];
  for (const source of PICK_ORDER) {
    const next = all.find((v) => v.source === source && !chosen.includes(v));
    if (next) chosen.push(next);
    if (chosen.length >= limit) break;
  }
  for (const voicing of all) {
    if (chosen.length >= limit) break;
    if (!chosen.includes(voicing)) chosen.push(voicing);
  }
  return chosen;
}

function targetFret(voicing) {
  const fretted = voicing?.frets?.filter((f) => typeof f === "number" && f > 0) || [];
  if (!fretted.length) return 0;
  return fretted.reduce((sum, f) => sum + f, 0) / fretted.length;
}

export function voicingDistance(shapeFrets, voicing) {
  if (!voicing) return 0;
  const target = targetFret(voicing);
  let cost = 0;
  shapeFrets.forEach((fret, stringIndex) => {
    if (fret === null) return;
    const other = voicing.frets[stringIndex];
    if (typeof other === "number") cost += Math.abs(fret - other);
    else cost += Math.abs(fret - target) + 2;
  });
  return cost;
}

function placeTriad(stringNums, triad, inversion) {
  const lowToHigh = [...stringNums].sort((a, b) => b - a);
  const order = [0, 1, 2].map((k) => triad[(inversion + k) % 3]);
  const found = [];
  for (let base = 0; base <= 12; base += 1) {
    const frets = [null, null, null, null, null, null];
    let prev = -1;
    let ok = true;
    for (let i = 0; i < 3; i += 1) {
      const stringIndex = 6 - lowToHigh[i];
      let hit = null;
      for (let fret = base; fret <= base + 3; fret += 1) {
        const midi = midiAt(stringIndex, fret);
        if (mod(midi, 12) === order[i].pc && midi > prev) {
          hit = { fret, midi };
          break;
        }
      }
      if (!hit) {
        ok = false;
        break;
      }
      prev = hit.midi;
      frets[stringIndex] = hit.fret;
    }
    if (ok) found.push(frets);
  }
  return found;
}

const INVERSIONS = ["根音位置", "第一轉位", "第二轉位"];

const STRING_PLAIN = {
  "123": "第 1–3 弦（高音三條）",
  "234": "第 2–4 弦（中間三條）",
};

function fretRangeLabel(frets) {
  const used = frets.filter((fret) => typeof fret === "number");
  if (!used.length) return "";
  const min = Math.min(...used);
  const max = Math.max(...used);
  if (max === 0) return "空弦";
  if (min === 0) return `空弦到第 ${max} 格`;
  if (min === max) return `第 ${min} 格`;
  return `第 ${min}–${max} 格`;
}

export function triadShapes(chord, reference) {
  const triad = triadMembers(chord);
  if (triad.length < 3) return [];
  const sets = [
    { id: "123", strings: [1, 2, 3], label: "1-2-3 弦" },
    { id: "234", strings: [2, 3, 4], label: "2-3-4 弦" },
  ];
  const shapes = [];
  for (const set of sets) {
    for (let inv = 0; inv < 3; inv += 1) {
      const placements = placeTriad(set.strings, triad, inv);
      if (!placements.length) continue;
      let best = placements[0];
      let bestCost = voicingDistance(best, reference);
      for (const frets of placements.slice(1)) {
        const cost = voicingDistance(frets, reference);
        if (cost < bestCost) {
          best = frets;
          bestCost = cost;
        }
      }
      const notes = [];
      best.forEach((fret, stringIndex) => {
        if (fret === null) return;
        const tone = triad.find((t) => t.pc === pcAt(stringIndex, fret));
        notes.push({
          string: 6 - stringIndex,
          stringIndex,
          fret,
          midi: midiAt(stringIndex, fret),
          pc: pcAt(stringIndex, fret),
          name: tone?.display || "",
          label: tone?.label || "",
        });
      });
      const ordered = [...notes].sort((a, b) => a.midi - b.midi);
      const orderLabel = ordered.map((note) => note.name).join("–");
      const degreeLabel = ordered.map((note) => note.label).join("–");
      shapes.push({
        id: `${set.id}-${inv}-${best.map((f) => (f === null ? "x" : f)).join(".")}`,
        frets: best,
        notes,
        setId: set.id,
        setLabel: set.label,
        stringPlain: STRING_PLAIN[set.id] || set.label,
        inversion: inv,
        inversionLabel: INVERSIONS[inv],
        orderLabel,
        degreeLabel,
        fretRange: fretRangeLabel(best),
        label: `${STRING_PLAIN[set.id] || set.label} · ${INVERSIONS[inv]} · ${orderLabel}`,
        distance: reference ? bestCost : 0,
        nearest: false,
        source: "triad",
        fingers: inferFingers(best, detectBarres(best)),
        barres: detectBarres(best),
      });
    }
  }
  if (reference && shapes.length) {
    let index = 0;
    shapes.forEach((shape, i) => {
      if (shape.distance < shapes[index].distance) index = i;
    });
    shapes[index].nearest = true;
  }
  return shapes;
}

export function movementCost(fromVoicing, toVoicing) {
  const a = fromVoicing.notes.map((n) => n.midi);
  const b = toVoicing.notes.map((n) => n.midi);
  const memo = new Map();
  const rec = (i, mask) => {
    if (i === a.length) {
      let extra = 0;
      for (let j = 0; j < b.length; j += 1) if ((mask & (1 << j)) === 0) extra += 6;
      return extra;
    }
    const key = `${i}:${mask}`;
    if (memo.has(key)) return memo.get(key);
    let best = 6 + rec(i + 1, mask);
    for (let j = 0; j < b.length; j += 1) {
      if (mask & (1 << j)) continue;
      const cost = Math.abs(a[i] - b[j]) + rec(i + 1, mask | (1 << j));
      if (cost < best) best = cost;
    }
    memo.set(key, best);
    return best;
  };
  return a.length && b.length ? rec(0, 0) : 99;
}

export function bestNextVoicing(fromVoicing, nextChord) {
  const candidates = allVoicings(nextChord);
  if (!candidates.length) return null;
  if (!fromVoicing) return candidates[0];
  let best = candidates[0];
  let bestCost = movementCost(fromVoicing, best);
  for (const candidate of candidates.slice(1)) {
    const cost = movementCost(fromVoicing, candidate);
    if (cost < bestCost) {
      best = candidate;
      bestCost = cost;
    }
  }
  return { ...best, movement: bestCost };
}
