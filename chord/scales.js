import { OPEN_PC, mod, pcAt } from "../shared/pitch.js";
import { displayName } from "../shared/theory.js";
import { Note, Scale } from "../vendor/tonal/tonal.js";

/** Offsets from the 6th-string root fret. Index 0 = low E. */
const MINOR_BOXES = [
  [[0, 3], [0, 2], [0, 2], [0, 2], [0, 3], [0, 3]],
  [[3, 5], [2, 5], [2, 5], [2, 4], [3, 5], [3, 5]],
  [[5, 7], [5, 7], [5, 7], [4, 7], [5, 8], [5, 7]],
  [[7, 10], [7, 10], [7, 9], [7, 9], [8, 10], [7, 10]],
  [[10, 12], [10, 12], [9, 12], [9, 12], [10, 12], [10, 12]],
];

const MAJOR_BOXES = [
  [[0, 2], [-1, 2], [-1, 2], [-1, 1], [0, 2], [0, 2]],
  [[2, 4], [2, 4], [2, 4], [1, 4], [2, 5], [2, 4]],
  [[4, 7], [4, 7], [4, 6], [4, 6], [5, 7], [4, 7]],
  [[7, 9], [7, 9], [6, 9], [6, 9], [7, 9], [7, 9]],
  [[9, 12], [9, 11], [9, 11], [9, 11], [9, 12], [9, 12]],
];

const SEMITONE_LABEL = {
  0: "R",
  1: "b2",
  2: "2",
  3: "b3",
  4: "3",
  5: "4",
  6: "b5",
  7: "5",
  8: "#5",
  9: "6",
  10: "b7",
  11: "7",
};

const SCALE_COPY = {
  "major pentatonic": "五個音，沒有半音衝突。大三、maj7 的安全落點，J-Pop 與 Post Rock 的開放旋律很好用。",
  ionian: "大調音階，也就是 Ionian。4 音緊貼大三度，Jazz 裡當成避免音，不要停在上面。",
  lydian: "Ionian 把 4 音升高。Lydian 的 #4 是色彩，不是避免音；Fusion 與 Post Rock 的大七和弦很適合。",
  "minor pentatonic": "Stage 2 的主幹。五聲框 1–5，第 1 框的根音在第 6 弦。Blues、Rock、Neo Soul 的單音都從這裡出發。",
  dorian: "小調色彩加上大六度。m7 最常用的音階；Neo Soul、Funk、Jazz 的長音可以落在 6 音。",
  aeolian: "自然小調。b6 會和小調的五度撞半音，是避免音；想要更暗的 J-Rock、Post Rock 再用它。",
  mixolydian: "屬七的第一選擇。4 音是避免音；Blues 與 Funk 的 V7 可以先只停在和弦音。",
  blues: "小調五聲加上 b5。4 和 b5 是藍調色彩音，不是避免音。Blues、Funk、Rock 的 dominant 都能用。",
  locrian: "m7b5 的和弦音階。b2 離根音只有半音，是避免音；iiø 先抓住 R、b3、b5、b7。",
  diminished: "全音–半音減音階，八個音。dim7 的每個和弦音都能當臨時根音，Jazz 的減七經過和弦用得上。",
  "whole tone": "六個全音，沒有明確的解決。aug 與 7#5 聽起來會漂，Fusion 可以短短用一下。",
  "melodic minor": "小三度加大七度。mmaj7 與 Fusion 的線條用它；上行的 6、7 音是色彩。",
  "half-whole diminished": "半音–全音減音階，從屬七根音開始。b9、#9、#11、b13 都是張力，7#9 與 7b9 可以拿來製造解決前的摩擦。",
};

const FAMILIES = {
  maj: [
    { id: "major pentatonic", en: "major pentatonic", pentatonic: "major" },
    { id: "ionian", en: "Ionian" },
    { id: "lydian", en: "Lydian" },
  ],
  m: [
    { id: "minor pentatonic", en: "minor pentatonic", pentatonic: "minor" },
    { id: "dorian", en: "Dorian" },
    { id: "aeolian", en: "Aeolian" },
  ],
  7: [
    { id: "mixolydian", en: "Mixolydian" },
    { id: "blues", en: "Blues", noAvoid: true },
  ],
  m7b5: [{ id: "locrian", en: "Locrian" }],
  dim: [
    { id: "diminished", en: "diminished" },
    { id: "locrian", en: "Locrian" },
  ],
  aug: [{ id: "whole tone", en: "whole tone", noAvoid: true }],
  sus: [
    { id: "major pentatonic", en: "major pentatonic", pentatonic: "major" },
    { id: "mixolydian", en: "Mixolydian" },
  ],
  other: [
    { id: "major pentatonic", en: "major pentatonic", pentatonic: "major" },
    { id: "minor pentatonic", en: "minor pentatonic", pentatonic: "minor" },
  ],
};

export function rootFretOnLowE(rootPc) {
  return mod(rootPc - OPEN_PC[0], 12);
}

export function pentatonicBox(root, kind, boxNumber) {
  const rootPc = typeof root === "number" ? root : Note.chroma(root);
  const table = kind === "major" ? MAJOR_BOXES : MINOR_BOXES;
  const index = Math.min(5, Math.max(1, boxNumber)) - 1;
  const pattern = table[index];
  let anchor = rootFretOnLowE(rootPc);
  const minOff = Math.min(...pattern.flat());
  if (anchor + minOff < 0) anchor += 12;
  const frets = pattern.map((offs) => offs.map((off) => anchor + off));
  const positions = [];
  frets.forEach((row, stringIndex) => {
    for (const fret of row) {
      const pc = pcAt(stringIndex, fret);
      positions.push({
        string: 6 - stringIndex,
        stringIndex,
        fret,
        pc,
        label: SEMITONE_LABEL[mod(pc - rootPc, 12)],
      });
    }
  });
  return {
    kind: kind === "major" ? "major" : "minor",
    box: index + 1,
    anchorFret: anchor,
    rootOnString6: anchor + pattern[0][0],
    frets,
    positions,
  };
}

export function scaleChoices(chord) {
  const base = FAMILIES[chord.family] || FAMILIES.other;
  const list = base.map((item) => ({ ...item, blurb: SCALE_COPY[item.id] || "" }));
  if (chord.qualityKey === "mmaj7" || chord.qualityKey === "mmaj9") {
    list.push({
      id: "melodic minor",
      en: "melodic minor",
      blurb: SCALE_COPY["melodic minor"],
    });
  }
  if (chord.qualityKey === "7b9" || chord.qualityKey === "7#9" || chord.qualityKey === "alt") {
    list.push({
      id: "half-whole diminished",
      en: "half-whole diminished",
      noAvoid: true,
      blurb: SCALE_COPY["half-whole diminished"],
    });
  }
  return list;
}

export function analyzeScale(chord, choice) {
  const found = Scale.get(`${chord.root} ${choice.id}`);
  const scaleTones = (found.notes || []).map((note, i) => ({
    note,
    display: displayName(note),
    pc: Note.chroma(note),
    interval: found.intervals?.[i] || "",
    label: SEMITONE_LABEL[mod(Note.chroma(note) - chord.rootPc, 12)] || found.intervals?.[i] || "",
  }));
  const chordPc = new Set(chord.pcs);
  const landing = [];
  const seenLanding = new Set();
  for (const tone of chord.tones) {
    if (seenLanding.has(tone.pc)) continue;
    seenLanding.add(tone.pc);
    landing.push(tone);
  }
  const avoids = [];
  if (choice.noAvoid !== true) {
    const seen = new Set();
    for (const tone of scaleTones) {
      if (chordPc.has(tone.pc) || seen.has(tone.pc)) continue;
      const halfAboveChord = chord.pcs.some((c) => mod(c + 1, 12) === tone.pc);
      if (!halfAboveChord) continue;
      if (choice.id === "lydian" && tone.pc === mod(chord.rootPc + 6, 12)) continue;
      seen.add(tone.pc);
      avoids.push(tone);
    }
  }
  return {
    id: choice.id,
    en: choice.en,
    blurb: choice.blurb,
    pentatonic: choice.pentatonic || null,
    noAvoid: choice.noAvoid === true,
    scaleTones,
    landing,
    avoids,
  };
}

function markerKind(label) {
  if (label === "R") return "root";
  if (label === "b3" || label === "3" || label === "4" || label === "2") return "third";
  if (label === "b5" || label === "5" || label === "#5") return "fifth";
  if (label === "bb7" || label === "b7" || label === "7") return "seventh";
  return "ext";
}

export function buildMarkers(chord, analysis, boxNumber, fretCount = 16) {
  const maxFret = fretCount - 1;
  let box = null;
  if (analysis?.pentatonic && boxNumber) {
    box = pentatonicBox(chord.rootPc, analysis.pentatonic, boxNumber);
  }
  const end = Math.max(maxFret, box ? Math.max(...box.positions.map((p) => p.fret)) : 0);
  const boxKey = new Set(box ? box.positions.map((p) => `${p.stringIndex}:${p.fret}`) : []);
  const scalePc = new Set(analysis ? analysis.scaleTones.map((t) => t.pc) : []);
  const avoidPc = new Set(analysis ? analysis.avoids.map((t) => t.pc) : []);
  const chordTone = new Map();
  for (const tone of chord.tones) if (!chordTone.has(tone.pc)) chordTone.set(tone.pc, tone);

  const markers = [];
  for (let stringIndex = 0; stringIndex < 6; stringIndex += 1) {
    for (let fret = 0; fret <= end; fret += 1) {
      const pc = pcAt(stringIndex, fret);
      const tone = chordTone.get(pc);
      const inScale = !analysis || scalePc.has(pc);
      if (analysis && !inScale && !tone) continue;
      if (!analysis && !tone) continue;
      const inBox = !box || boxKey.has(`${stringIndex}:${fret}`);
      let kind = "scale";
      let label = tone?.label || SEMITONE_LABEL[mod(pc - chord.rootPc, 12)];
      if (tone) {
        kind = markerKind(tone.label);
        label = tone.label;
      }
      if (analysis && avoidPc.has(pc) && !tone) kind = "avoid";
      if (box && !inBox) kind = "ghost";
      if (!analysis && !tone) continue;
      markers.push({
        string: 6 - stringIndex,
        stringIndex,
        fret,
        pc,
        label,
        kind,
      });
    }
  }
  return { markers, fretCount: end + 1, box };
}
