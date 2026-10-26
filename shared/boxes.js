/** Pentatonic boxes shared by the chord explorer and the fretboard trainer. */
import { Note } from "../vendor/tonal/tonal.js";
import { OPEN_PC, mod, pcAt } from "./pitch.js";

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

/** Chromatic degree from a root, jazz spelling. */
export const DEGREE_LABELS = {
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
        label: DEGREE_LABELS[mod(pc - rootPc, 12)],
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
