import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { pentatonicBox, analyzeScale, scaleChoices } from "../chord/scales.js";
import { parseHash, serializeHash } from "../chord/state.js";
import { guideToneLines, progressionFor } from "../chord/voiceleading.js";
import { fretSpan, voicingsFor } from "../chord/voicings.js";
import { chordDiagramSvg, neckSvg } from "../shared/diagram.js";
import { parseChord } from "../shared/theory.js";
import { TOOLS } from "../shared/registry.js";
import {
  GUITARS,
  SYNTH_ID,
  TONE_STORAGE_KEY,
  leadingSilenceOffset,
  nearestSample,
  playbackRate,
  readTone,
  writeTone,
} from "../shared/samples/index.js";

const CASES = [
  ["C", "C", ["R", "3", "5"], [0, 4, 7]],
  ["Am", "A", ["R", "b3", "5"], [9, 0, 4]],
  ["G7", "G", ["R", "3", "5", "b7"], [7, 11, 2, 5]],
  ["Dm7", "D", ["R", "b3", "5", "b7"], [2, 5, 9, 0]],
  ["Dm7b5", "D", ["R", "b3", "b5", "b7"], [2, 5, 8, 0]],
  ["Cmaj7", "C", ["R", "3", "5", "7"], [0, 4, 7, 11]],
  ["Cmaj9", "C", ["R", "3", "5", "7", "9"], [0, 4, 7, 11, 2]],
  ["E7#9", "E", ["R", "3", "5", "b7", "#9"], [4, 8, 11, 2, 7]],
  ["Csus4", "C", ["R", "4", "5"], [0, 5, 7]],
  ["sus4", "C", ["R", "4", "5"], [0, 5, 7]],
  ["Cdim7", "C", ["R", "b3", "b5", "bb7"], [0, 3, 6, 9]],
  ["dim7", "C", ["R", "b3", "b5", "bb7"], [0, 3, 6, 9]],
  ["m7b5", "C", ["R", "b3", "b5", "b7"], [0, 3, 6, 10]],
  ["7#9", "C", ["R", "3", "5", "b7", "#9"], [0, 4, 7, 10, 3]],
  ["maj9", "C", ["R", "3", "5", "7", "9"], [0, 4, 7, 11, 2]],
  ["F#m7", "F#", ["R", "b3", "5", "b7"], [6, 9, 1, 4]],
  ["Bbmaj7", "Bb", ["R", "3", "5", "7"], [10, 2, 5, 9]],
  ["Am7", "A", ["R", "b3", "5", "b7"], [9, 0, 4, 7]],
  ["E7", "E", ["R", "3", "5", "b7"], [4, 8, 11, 2]],
  ["C7", "C", ["R", "3", "5", "b7"], [0, 4, 7, 10]],
  ["Abmaj9", "Ab", ["R", "3", "5", "7", "9"], [8, 0, 3, 7, 10]],
  ["Dsus4", "D", ["R", "4", "5"], [2, 7, 9]],
  ["Gdim7", "G", ["R", "b3", "b5", "bb7"], [7, 10, 1, 4]],
  ["Bm7b5", "B", ["R", "b3", "b5", "b7"], [11, 2, 5, 9]],
  ["A7#9", "A", ["R", "3", "5", "b7", "#9"], [9, 1, 4, 7, 0]],
  ["Em", "E", ["R", "b3", "5"], [4, 7, 11]],
  ["Fmaj7", "F", ["R", "3", "5", "7"], [5, 9, 0, 4]],
  ["Cadd9", "C", ["R", "3", "5", "9"], [0, 4, 7, 2]],
  ["Asus2", "A", ["R", "2", "5"], [9, 11, 4]],
  ["F7sus4", "F", ["R", "4", "5", "b7"], [5, 10, 0, 3]],
];

test("thirty chords parse, including m7b5, 7#9, maj9, sus4, dim7", () => {
  assert.equal(CASES.length, 30);
  for (const [symbol, root, labels, pcs] of CASES) {
    const chord = parseChord(symbol);
    assert.equal(chord.empty, false, symbol);
    assert.equal(chord.root, root, symbol);
    assert.deepEqual(chord.labels, labels, symbol);
    assert.deepEqual(chord.pcs, pcs, symbol);
  }
});

const COMMON = ["C", "G", "D", "A", "E", "Am", "Em", "Dm", "C7", "G7", "A7", "E7", "Am7", "Dm7", "Cmaj7", "Dm7b5", "E7#9", "Cmaj9", "Csus4", "Cdim7"];

test("common chords have at least 3 playable voicings inside a 4-fret span", () => {
  for (const symbol of COMMON) {
    const list = voicingsFor(parseChord(symbol));
    assert.ok(list.length >= 3, `${symbol} has ${list.length}`);
    for (const voicing of list) {
      assert.ok(fretSpan(voicing.frets) <= 4, `${symbol} ${voicing.label}`);
      assert.ok(voicing.notes.length >= 3, symbol);
    }
  }
});

function grip(voicing) {
  return voicing.frets.map((fret) => (fret === null ? "x" : fret)).join(",");
}

test("open C and the E7#9 grip are present", () => {
  const c = voicingsFor(parseChord("C")).map(grip);
  assert.ok(c.includes("x,3,2,0,1,0"), c.join(" | "));
  const shapes = voicingsFor(parseChord("E7#9")).map(grip);
  assert.ok(shapes.includes("0,2,0,1,0,3"), shapes.join(" | "));
});

test("Am minor pentatonic box 1 sits at fret 5 on the 6th string", () => {
  const box = pentatonicBox("A", "minor", 1);
  assert.equal(box.anchorFret, 5);
  assert.ok(box.frets[0].includes(5));
  assert.equal(box.rootOnString6, 5);
  const minor = [0, 3, 5, 7, 10];
  const major = [0, 2, 4, 7, 9];
  for (const kind of ["minor", "major"]) {
    const rootPc = kind === "minor" ? 9 : 0;
    const scale = kind === "minor" ? minor : major;
    for (let number = 1; number <= 5; number += 1) {
      const shape = pentatonicBox(rootPc, kind, number);
      for (const note of shape.positions) {
        assert.ok(scale.includes((note.pc - rootPc + 12) % 12), `${kind} box ${number}`);
        assert.ok(note.fret >= 0);
      }
    }
  }
  const cMajor = pentatonicBox("C", "major", 1);
  assert.equal(cMajor.rootOnString6, 8);
});

test("C major ii–V–I guide tones are F→F→E and C→B→B", () => {
  const symbols = progressionFor("C", "251");
  assert.deepEqual(symbols, ["Dm7", "G7", "Cmaj7"]);
  const lines = guideToneLines(symbols).map((line) => line.map((note) => note.name).join("→"));
  assert.ok(lines.includes("F→F→E"), lines.join(" | "));
  assert.ok(lines.includes("C→B→B"), lines.join(" | "));
});

test("avoid notes follow chord-scale rules", () => {
  const major = parseChord("Cmaj7");
  const ionian = analyzeScale(major, scaleChoices(major).find((choice) => choice.id === "ionian"));
  const lydian = analyzeScale(major, scaleChoices(major).find((choice) => choice.id === "lydian"));
  assert.deepEqual(ionian.avoids.map((tone) => tone.display), ["F"]);
  assert.deepEqual(lydian.avoids, []);
  const dominant = parseChord("G7");
  const mix = analyzeScale(dominant, scaleChoices(dominant).find((choice) => choice.id === "mixolydian"));
  const blues = analyzeScale(dominant, scaleChoices(dominant).find((choice) => choice.id === "blues"));
  assert.deepEqual(mix.avoids.map((tone) => tone.display), ["C"]);
  assert.deepEqual(blues.avoids, []);
  const half = parseChord("Bm7b5");
  const locrian = analyzeScale(half, scaleChoices(half)[0]);
  assert.deepEqual(locrian.avoids.map((tone) => tone.display), ["C"]);
});

test("hash keeps chord and next chord", () => {
  const parsed = parseHash("#chord=Am7&next=D7");
  assert.equal(parsed.chord, "Am7");
  assert.equal(parsed.next, "D7");
  const hash = serializeHash({ chord: "E7#9", next: "Am7", voicing: "", scale: "", box: 1, prog: "" });
  assert.match(hash, /^chord=E7%239&next=Am7$/);
  assert.equal(parseHash(`#${hash}`).chord, "E7#9");
});

test("diagrams are svg and name the strings in Chinese", () => {
  const chord = parseChord("C");
  const voicing = voicingsFor(chord)[0];
  const svg = chordDiagramSvg(voicing);
  assert.match(svg, /<svg/);
  assert.match(svg, /弦/);
  const neck = neckSvg({ markers: [{ string: 6, stringIndex: 0, fret: 5, label: "R", kind: "root" }], fretCount: 16 });
  assert.match(neck, /<svg/);
  assert.match(neck, /dot-root/);
});

test("user-facing pages stay in Traditional Chinese", () => {
  const files = [
    "index.html",
    "chord/index.html",
    "chord/app.js",
    "chord/explain.js",
    "shared/registry.js",
    "shared/home.js",
    "shared/tone.js",
    "README.md",
    "AGENTS.md",
  ];
  const simplified = ["这个", "设置", "练习记录", "节拍器", "即将推出", "指板训练"];
  const required = ["和弦探索器", "節拍器", "練習紀錄", "指板訓練", "即將推出"];
  const blob = files.map((file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8")).join("\n");
  for (const word of simplified) assert.equal(blob.includes(word), false, word);
  for (const word of required) {
    assert.equal(blob.includes(word), true, word);
  }
  assert.match(blob, /guide tone/);
  assert.match(blob, /shell voicing/);
  assert.match(blob, /Drop 2/);
  assert.match(blob, /Dorian/);
  assert.match(readFileSync(new URL("../index.html", import.meta.url), "utf8"), /lang="zh-Hant"/);
});

test("every tool is registered once and the landing page reads that list", () => {
  assert.deepEqual(
    TOOLS.map((tool) => tool.slug),
    ["chord", "metronome", "log", "fretboard"],
  );
  assert.equal(TOOLS.find((tool) => tool.slug === "chord").status, "live");
  assert.deepEqual(
    TOOLS.filter((tool) => tool.status === "soon").map((tool) => tool.slug),
    ["metronome", "log", "fretboard"],
  );
  const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const home = readFileSync(new URL("../shared/home.js", import.meta.url), "utf8");
  assert.match(index, /id="tool-list"/);
  assert.match(index, /shared\/home\.js/);
  assert.match(home, /TOOLS/);
  assert.equal(index.includes("節拍器"), false);
  assert.match(readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8"), /shared\//);
  assert.match(readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8"), /vendor\//);
});

test("nearest recorded fret stays on the same string", () => {
  const manifest = JSON.parse(readFileSync(new URL("../shared/samples/greco/manifest.json", import.meta.url), "utf8"));
  const samples = manifest.samples;
  assert.equal(GUITARS[0].id, "greco");
  assert.equal(samples.length, 24);

  const open = nearestSample(samples, 6, 0);
  assert.equal(open.sample.file, "s6f0.mp3");
  assert.equal(open.semitones, 0);

  const oneUp = nearestSample(samples, 5, 5);
  assert.equal(oneUp.sample.file, "s5f4.mp3");
  assert.equal(oneUp.semitones, 1);

  const tie = nearestSample(samples, 1, 2);
  assert.equal(tie.sample.file, "s1f0.mp3");
  assert.equal(tie.semitones, 2);
  assert.equal(nearestSample(samples, 2, 10).sample.file, "s2f8.mp3");
  assert.ok(Math.abs(playbackRate(tie.semitones) - 2 ** (2 / 12)) < 1e-9);

  const above = nearestSample(samples, 1, 15);
  assert.equal(above.sample.file, "s1f12.mp3");
  assert.equal(above.semitones, 3);

  const eleventh = nearestSample(samples, 3, 11);
  assert.equal(eleventh.sample.file, "s3f12.mp3");
  assert.equal(eleventh.semitones, -1);

  assert.equal(nearestSample(samples, 9, 0), null);
  assert.equal(nearestSample(samples, 4, -1), null);

  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  assert.equal(readTone(storage), "greco");
  assert.equal(writeTone(storage, SYNTH_ID), SYNTH_ID);
  assert.equal(storage.getItem(TONE_STORAGE_KEY), SYNTH_ID);
  assert.equal(readTone(storage), SYNTH_ID);

  const channel = new Float32Array(48000);
  channel[1200] = 0.4;
  const offset = leadingSilenceOffset(channel, 48000);
  assert.ok(offset > 0.02 && offset < 0.025);
});
