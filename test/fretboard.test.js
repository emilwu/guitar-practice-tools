import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { pentatonicBox } from "../shared/boxes.js";
import { neckSvg } from "../shared/diagram.js";
import { midiAt, pcAt } from "../shared/pitch.js";
import {
  gradeInterval,
  gradeName,
  gradeTaps,
  intervalBetween,
  intervalFromSemitones,
  makeQuestion,
  noteName,
  pcFromName,
  pitchAt,
  positionsInRange,
  scaleBox,
} from "../fretboard/logic.js";
import { DEFAULT_SETTINGS, loadSettings, normalizeSettings, parseHash, serializeHash } from "../fretboard/state.js";
import { emptyStats, heatmapCells, loadStats, noteRows, recordStat, saveStats, stringRows, summarize } from "../fretboard/stats.js";

const OPEN = [
  [0, "E", 40],
  [1, "A", 45],
  [2, "D", 50],
  [3, "G", 55],
  [4, "B", 59],
  [5, "E", 64],
];

test("open strings and a few frets name the right pitch", () => {
  for (const [stringIndex, name, midi] of OPEN) {
    const pitch = pitchAt(stringIndex, 0);
    assert.equal(pitch.name, name);
    assert.equal(pitch.midi, midi);
    assert.equal(pitch.pc, pcAt(stringIndex, 0));
    assert.equal(pitch.string, 6 - stringIndex);
  }
  assert.equal(pitchAt(0, 1).name, "F");
  assert.equal(pitchAt(0, 5).name, "A");
  assert.equal(pitchAt(4, 1).name, "C");
  assert.equal(pitchAt(0, 0).midi, midiAt(0, 0));
  assert.equal(noteName(1, "sharp"), "C#");
  assert.equal(noteName(1, "flat"), "Db");
  assert.equal(noteName(10, "flat"), "Bb");
  assert.equal(pcFromName("C#"), 1);
  assert.equal(pcFromName("Db"), 1);
  assert.equal(pcFromName("E#"), 5);
  assert.equal(pcFromName("Fb"), 4);
  assert.equal(pcFromName("bb"), 10);
  assert.equal(pcFromName("H"), null);
  assert.equal(gradeName(1, "C#"), true);
  assert.equal(gradeName(1, "Db"), true);
  assert.equal(gradeName(1, "D"), false);
});

test("A sits on the usual frets between 0 and 12", () => {
  const spots = positionsInRange({ strings: [6, 5, 4, 3, 2, 1], fretMin: 0, fretMax: 12, pcs: [9] });
  assert.deepEqual(
    spots.map((spot) => [spot.stringIndex, spot.fret]),
    [
      [0, 5],
      [1, 0],
      [1, 12],
      [2, 7],
      [3, 2],
      [4, 10],
      [5, 5],
    ],
  );
  const lowOnly = positionsInRange({ strings: [6], fretMin: 0, fretMax: 12, pcs: [9] });
  assert.deepEqual(lowOnly.map((spot) => spot.fret), [5]);
});

test("interval names accept enharmonic degree labels", () => {
  assert.equal(intervalFromSemitones(0).label, "R");
  assert.equal(intervalFromSemitones(3).label, "b3");
  assert.equal(intervalFromSemitones(4).label, "3");
  assert.equal(intervalFromSemitones(7).label, "5");
  assert.equal(intervalFromSemitones(10).label, "b7");
  assert.equal(gradeInterval(6, "b5"), true);
  assert.equal(gradeInterval(6, "#4"), true);
  assert.equal(gradeInterval(6, "#11"), true);
  assert.equal(gradeInterval(6, "5"), false);
  assert.equal(gradeInterval(8, "#5"), true);
  assert.equal(gradeInterval(8, "b6"), true);
  const fifth = intervalBetween(pitchAt(0, 0), pitchAt(0, 7));
  assert.equal(fifth.label, "5");
  const minorThird = intervalBetween(pitchAt(0, 5), pitchAt(0, 8));
  assert.equal(minorThird.label, "b3");
  assert.equal(minorThird.semitones, 3);
  const across = intervalBetween(pitchAt(0, 5), pitchAt(4, 1));
  assert.equal(across.label, "b3");
});

function spotKey(position) {
  return `${position.stringIndex}:${position.fret}`;
}

test("pentatonic and blues boxes match the shared CAGED shapes", () => {
  const minor = scaleBox({ key: "A", scale: "min-pent", shape: "E", strings: [1, 2, 3, 4, 5, 6], fretMin: 0, fretMax: 12 });
  const shared = pentatonicBox("A", "minor", 1);
  assert.equal(minor.root.string, 6);
  assert.equal(minor.root.fret, 5);
  assert.equal(minor.fitsRange, true);
  assert.deepEqual(minor.positions.map(spotKey).sort(), shared.positions.map(spotKey).sort());
  assert.ok(minor.positions.every((position) => [0, 3, 5, 7, 10].includes((position.pc - 9 + 12) % 12)));

  const major = scaleBox({ key: "C", scale: "maj-pent", shape: "E", strings: [1, 2, 3, 4, 5, 6], fretMin: 0, fretMax: 15 });
  assert.equal(major.root.fret, 8);
  assert.equal(major.root.string, 6);

  const blues = scaleBox({ key: "A", scale: "blues", shape: "E", strings: [1, 2, 3, 4, 5, 6], fretMin: 0, fretMax: 12 });
  for (const position of minor.positions) {
    assert.ok(blues.positions.some((item) => spotKey(item) === spotKey(position)));
  }
  const extra = blues.positions.filter((position) => !minor.positions.some((item) => spotKey(item) === spotKey(position)));
  assert.ok(extra.length > 0);
  assert.ok(extra.every((position) => (position.pc - 9 + 12) % 12 === 6));
  assert.ok(extra.some((position) => position.stringIndex === 1 && position.fret === 6));
});

test("major and natural minor CAGED windows stay inside the scale", () => {
  const major = scaleBox({ key: "C", scale: "major", shape: "E", strings: [1, 2, 3, 4, 5, 6], fretMin: 0, fretMax: 15 });
  const has = (stringIndex, fret) => major.positions.some((position) => position.stringIndex === stringIndex && position.fret === fret);
  assert.equal(major.fretMin, 8);
  assert.equal(major.fretMax, 12);
  assert.equal(has(0, 8), true);
  assert.equal(has(1, 10), true);
  assert.equal(has(2, 10), true);
  assert.equal(has(3, 9), true);
  assert.equal(has(4, 8), true);
  assert.equal(has(5, 8), true);

  const aShape = scaleBox({ key: "C", scale: "major", shape: "A", strings: [1, 2, 3, 4, 5, 6], fretMin: 0, fretMax: 15 });
  assert.ok(aShape.positions.some((position) => position.stringIndex === 1 && position.fret === 3 && position.pc === 0));

  const natural = scaleBox({ key: "A", scale: "minor", shape: "E", strings: [1, 2, 3, 4, 5, 6], fretMin: 0, fretMax: 15 });
  assert.ok(natural.positions.some((position) => position.pc === 5));

  const high = scaleBox({ key: "E", scale: "min-pent", shape: "E", strings: [1, 2, 3, 4, 5, 6], fretMin: 12, fretMax: 15 });
  assert.ok(high.positions.some((position) => position.stringIndex === 0 && position.fret === 12));
  assert.equal(high.fitsRange, true);

  for (const key of ["C", "F#", "Bb", "E"]) {
    for (const scale of ["major", "minor", "maj-pent", "min-pent", "blues"]) {
      for (const shape of ["C", "A", "G", "E", "D"]) {
        const box = scaleBox({ key, scale, shape, strings: [1, 2, 3, 4, 5, 6], fretMin: 0, fretMax: 15 });
        assert.ok(box, `${key} ${scale} ${shape}`);
        assert.ok(box.positions.length >= 4, `${key} ${scale} ${shape}`);
        const pcs = box.positions.map((position) => (position.pc - box.keyPc + 12) % 12);
        const allowed = {
          major: [0, 2, 4, 5, 7, 9, 11],
          minor: [0, 2, 3, 5, 7, 8, 10],
          "maj-pent": [0, 2, 4, 7, 9],
          "min-pent": [0, 3, 5, 7, 10],
          blues: [0, 3, 5, 6, 7, 10],
        }[scale];
        for (const position of box.positions) {
          assert.ok(position.fret >= 0 && position.fret <= 15, `${key} ${scale} ${shape} fret ${position.fret}`);
          assert.ok(allowed.includes((position.pc - box.keyPc + 12) % 12));
        }
        assert.equal(new Set(pcs).size > 0, true);
      }
    }
  }
});

test("questions stay inside the string and fret filters", () => {
  const find = makeQuestion(
    normalizeSettings({ mode: "find", naturals: true, strings: [6], fretMin: 0, fretMax: 12 }),
    () => 0,
  );
  assert.equal(find.type, "find");
  assert.ok([0, 2, 4, 5, 7, 9, 11].includes(find.pc));
  assert.ok(find.targets.length >= 1);
  assert.ok(find.targets.every((target) => target.pc === find.pc && target.string === 6 && target.fret <= 12));

  const scale = makeQuestion(normalizeSettings({ mode: "scale", key: "A", scale: "min-pent", shape: "E", fretMin: 0, fretMax: 12 }), () => 0.4);
  assert.equal(scale.type, "scale");
  assert.ok(scale.targets.some((target) => target.stringIndex === 0 && target.fret === 5));
  assert.ok(scale.targets.every((target) => [0, 3, 5, 7, 10].includes((target.pc - 9 + 12) % 12)));
});

test("tap grading counts misses and extras", () => {
  const targets = [pitchAt(0, 5), pitchAt(1, 0)];
  const both = gradeTaps(targets, [pitchAt(0, 5), pitchAt(1, 0)]);
  assert.equal(both.foundAll, true);
  assert.equal(both.clean, true);
  assert.equal(both.accuracy, 1);
  const messy = gradeTaps(targets, [pitchAt(0, 5), pitchAt(1, 0), pitchAt(2, 3)]);
  assert.equal(messy.correct, 2);
  assert.equal(messy.wrong, 1);
  assert.equal(messy.missed, 0);
  assert.equal(messy.foundAll, true);
  assert.equal(messy.clean, false);
  assert.equal(messy.accuracy, 2 / 3);
  const half = gradeTaps(targets, [pitchAt(0, 5)]);
  assert.equal(half.missed, 1);
  assert.equal(half.foundAll, false);
});

test("heatmap aggregates accuracy and response time without counting untimed misses", () => {
  const before = emptyStats();
  let stats = recordStat(before, { pc: 9, string: 6, stringIndex: 0, fret: 5, correct: false, ms: 2000 });
  stats = recordStat(stats, { pc: 9, string: 6, stringIndex: 0, fret: 5, correct: false, ms: 1000 });
  stats = recordStat(stats, { pc: 9, string: 6, stringIndex: 0, fret: 7, correct: true, ms: 500 });
  stats = recordStat(stats, { pc: 9, string: 5, stringIndex: 1, fret: 0, correct: false, ms: null });
  assert.equal(summarize(before.notes["9"]).attempts, 0);
  const cells = heatmapCells(stats);
  assert.equal(cells[0].stringIndex, 0);
  assert.equal(cells[0].fret, 5);
  assert.equal(cells[0].weakness, 1);
  assert.equal(summarize(stats.notes["9"]).accuracy, 1 / 4);
  assert.equal(summarize(stats.strings["6"]).avgMs, (2000 + 1000 + 500) / 3);
  assert.equal(summarize(stats.cells["1:0"]).attempts, 1);
  assert.equal(summarize(stats.cells["1:0"]).avgMs, null);
  assert.equal(noteRows(stats, "sharp")[0].name, "A");
  assert.deepEqual(
    stringRows(stats).map((row) => row.string),
    [6, 5],
  );
  const flat = recordStat(emptyStats(), { pc: 1, string: 1, stringIndex: 5, fret: 1, correct: false, ms: 800 });
  assert.equal(noteRows(flat, "flat")[0].name, "Db");
  assert.equal(noteRows(flat, "sharp")[0].name, "C#");

  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  saveStats(storage, stats);
  assert.equal(loadStats(storage).cells["0:5"].attempts, 2);
  saveStats(storage, emptyStats());
  assert.deepEqual(heatmapCells(loadStats(storage)), []);
});

test("hash presets round-trip and document the deep-link keys", () => {
  assert.equal(serializeHash(DEFAULT_SETTINGS), "");
  const hash = serializeHash({
    ...DEFAULT_SETTINGS,
    strings: DEFAULT_SETTINGS.strings.slice(),
    degrees: DEFAULT_SETTINGS.degrees.slice(),
    mode: "scale",
    key: "F#",
    scale: "major",
    shape: "A",
    naturals: true,
    timer: 60,
    spell: "flat",
    sound: false,
    fretMin: 0,
    fretMax: 15,
  });
  assert.match(hash, /mode=scale/);
  assert.match(hash, /key=F%23/);
  assert.match(hash, /scale=major/);
  assert.match(hash, /shape=A/);
  assert.match(hash, /naturals=1/);
  assert.match(hash, /timer=60/);
  assert.match(hash, /spell=flat/);
  assert.match(hash, /sound=0/);
  assert.match(hash, /frets=0-15/);
  const parsed = parseHash(`#${hash}`);
  assert.equal(parsed.key, "F#");
  assert.equal(parsed.scale, "major");
  assert.equal(parsed.shape, "A");
  assert.equal(parsed.timer, 60);
  assert.equal(parsed.sound, false);
  assert.equal(parsed.fretMax, 15);

  const strings = parseHash("#mode=name&strings=321&spell=flat");
  assert.deepEqual(strings.strings, [3, 2, 1]);
  assert.equal(strings.spell, "flat");
  const degrees = parseHash("#mode=interval&imode=locate&degrees=b3,3,5,b7");
  assert.deepEqual(degrees.degrees, ["b3", "3", "5", "b7"]);
  assert.equal(parseHash("#imode=find").imode, "locate");
  assert.deepEqual(parseHash("#mode=interval&degrees=%234").degrees, ["b5"]);
  assert.equal(parseHash("#frets=3-7").fretMin, 3);
  assert.equal(parseHash("#frets=9-2").fretMin, 2);
  assert.equal(parseHash("#frets=9-2").fretMax, 9);

  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  assert.equal(loadSettings("", storage).mode, "find");
  storage.setItem("guitar-tools.fretboard.v1", JSON.stringify({ mode: "name", spell: "flat" }));
  assert.equal(loadSettings("", storage).mode, "name");
  assert.equal(loadSettings("#mode=scale&key=A&scale=min-pent&shape=E", storage).mode, "scale");
});

test("the trainer page is static, relative, and wired into the cache", () => {
  const html = readFileSync(new URL("../fretboard/index.html", import.meta.url), "utf8");
  assert.match(html, /lang="zh-Hant"/);
  assert.match(html, /指板訓練/);
  assert.equal(/(?:href|src)=["']\//.test(html), false);
  const app = readFileSync(new URL("../fretboard/app.js", import.meta.url), "utf8");
  assert.equal(/(?:href|src)=["']\//.test(app), false);
  assert.match(app, /mountToneSelect/);
  assert.match(app, /playNotes/);
  const worker = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  for (const file of ["fretboard/app.js", "fretboard/logic.js", "fretboard/state.js", "fretboard/stats.js", "fretboard/fretboard.css", "shared/boxes.js"]) {
    assert.match(worker, new RegExp(file.replaceAll("/", "\\/")));
  }
  const plain = neckSvg({ markers: [{ stringIndex: 0, fret: 5, label: "R", kind: "root" }] });
  assert.equal(plain.includes("neck-hit"), false);
  assert.match(plain, /dot-root/);
  const hit = neckSvg({ targets: [{ stringIndex: 0, fret: 5, state: "lit" }] });
  assert.match(hit, /data-fret="5"/);
  assert.match(hit, /neck-hit is-lit/);
});
