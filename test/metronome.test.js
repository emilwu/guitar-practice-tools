import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  HASH_EXAMPLE,
  STORAGE_KEY,
  TRIPLET_SWING_EXACT,
  TRIPLET_SWING_PERCENT,
  advancePosition,
  averageTapTempo,
  barAudible,
  clickOffsets,
  cycleAccent,
  defaultAccents,
  eighthSwingOffsets,
  formatAccents,
  jazzAccents,
  ladderAtBar,
  ladderBpms,
  loadState,
  normalizePosition,
  parseHash,
  resolveBpm,
  serializeHash,
  soundAt,
  stepDuration,
  walkClicks,
} from "../metronome/timing.js";

function near(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} ~= ${expected}`);
}

test("swing offsets go from straight eighths to a 2:1 triplet and a 3:1 heavy swing", () => {
  const beat = 0.5;
  const straight = eighthSwingOffsets(beat, 50);
  assert.deepEqual(straight, [0, 0.25]);
  const triplet = eighthSwingOffsets(beat, TRIPLET_SWING_EXACT);
  assert.equal(triplet[0], 0);
  near(triplet[1] / (beat - triplet[1]), 2);
  const heavy = eighthSwingOffsets(beat, 75);
  near(heavy[1] / (beat - heavy[1]), 3);
  assert.ok(Math.abs(TRIPLET_SWING_PERCENT - TRIPLET_SWING_EXACT) < 0.5);

  const durations = [0, 1].map((index) => stepDuration(beat, "eighth", TRIPLET_SWING_EXACT, index));
  near(durations[0] + durations[1], beat);
  near(durations[0] / durations[1], 2);

  assert.deepEqual(
    clickOffsets(1, "sixteenth", 75).map((item) => item.time),
    [0, 0.25, 0.5, 0.75],
  );
  clickOffsets(1, "triplet", 75).forEach((item, index) => near(item.time, index / 3));
  assert.deepEqual(eighthSwingOffsets(1, 10), [0, 0.5]);
  assert.deepEqual(eighthSwingOffsets(1, 99), [0, 0.75]);
});

test("BPM ladder steps up, clamps an uneven last step, steps down, and holds the target", () => {
  assert.deepEqual(ladderBpms(80, 120, 5), [80, 85, 90, 95, 100, 105, 110, 115, 120]);
  assert.deepEqual(ladderBpms(80, 100, 15), [80, 95, 100]);
  assert.deepEqual(ladderBpms(100, 80, 10), [100, 90, 80]);
  assert.deepEqual(ladderBpms(90, 90, 5), [90]);
  assert.deepEqual(ladderBpms(10, 400, 270), [30, 300]);
  assert.equal(ladderBpms(80, 90, 0)[1], 81);

  const plan = { ladderOn: true, ladderStart: 80, ladderTarget: 90, ladderStep: 5, ladderBars: 4 };
  assert.equal(ladderAtBar(0, plan).bpm, 80);
  assert.equal(ladderAtBar(4, plan).index, 1);
  assert.equal(ladderAtBar(4, plan).bpm, 85);
  assert.equal(ladderAtBar(4, plan).barInStep, 0);
  assert.equal(ladderAtBar(11, plan).finished, false);
  assert.equal(ladderAtBar(12, plan).finished, true);
  assert.equal(resolveBpm(20, plan), 90);
  assert.equal(resolveBpm(3, { ...plan, ladderOn: false, bpm: 77 }), 77);
});

test("mute-bar pattern is 2 on then 2 off, and muted beats skip their subdivisions", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 7].map((bar) => barAudible(bar, 2, 2)),
    [true, true, false, false, true, true, false, false],
  );
  assert.equal(barAudible(5, 4, 0), true);
  assert.equal(barAudible(1, 1, 1), false);

  const muted = walkClicks(2, {
    bpm: 60,
    meter: "4/4",
    subdivision: "quarter",
    playBars: 1,
    muteBars: 1,
    accents: ["accent", "normal", "normal", "normal"],
  });
  assert.deepEqual(
    muted.map((event) => event.sound),
    ["accent", "normal", "normal", "normal", null, null, null, null],
  );
  muted.forEach((event, index) => near(event.time, index));

  const jazz = walkClicks(1, parseHash(`#${HASH_EXAMPLE}`));
  assert.deepEqual(
    jazz.map((event) => event.sound),
    [null, null, "accent", "subdivision", null, null, "accent", "subdivision"],
  );
  assert.equal(jazz[0].bpm, 60);
  near(jazz[1].time, 0.5);
  near(jazz[2].time, 1);
  near(jazz[7].time, 3.5);
});

test("tap tempo averages recent gaps, restarts after a long pause, and clamps", () => {
  assert.equal(averageTapTempo([0, 500, 1000, 1500]), 120);
  assert.equal(averageTapTempo([0, 500, 1000, 5000]), null);
  assert.equal(averageTapTempo([0, 500, 1000, 5000, 5500]), 120);
  assert.equal(averageTapTempo([0, 100, 200]), 300);
  assert.equal(averageTapTempo([0, 2500]), null);
  assert.equal(averageTapTempo([0, 2000]), 30);
  assert.equal(averageTapTempo([10]), null);
  assert.equal(averageTapTempo([]), null);
});

test("accent cycle and the jazz 2-and-4 preset", () => {
  assert.equal(cycleAccent("accent"), "normal");
  assert.equal(cycleAccent("normal"), "mute");
  assert.equal(cycleAccent("mute"), "accent");
  assert.deepEqual(jazzAccents("4/4"), ["mute", "accent", "mute", "accent"]);
  assert.equal(formatAccents(jazzAccents("4/4")), "mama");
  assert.deepEqual(jazzAccents("5/4"), ["mute", "accent", "mute", "accent", "normal"]);
  assert.deepEqual(defaultAccents("6/8"), ["accent", "normal", "normal", "accent", "normal", "normal"]);
  assert.equal(defaultAccents("12/8").filter((level) => level === "accent").length, 4);
  const wrapped = advancePosition({ bar: 0, beat: 3, sub: 1 }, "4/4", "eighth");
  assert.deepEqual(wrapped, { bar: 1, beat: 0, sub: 0 });
  assert.deepEqual(normalizePosition({ bar: 0, beat: 1, sub: 3 }, "4/4", "quarter"), { bar: 0, beat: 2, sub: 0 });
});

test("the learning-map hash is a full preset and round-trips", () => {
  const preset = parseHash(`#${HASH_EXAMPLE}`);
  assert.equal(preset.bpm, 60);
  assert.equal(preset.meter, "4/4");
  assert.equal(preset.subdivision, "eighth");
  assert.equal(preset.swing, 50);
  assert.deepEqual(preset.accents, ["mute", "accent", "mute", "accent"]);
  assert.equal(preset.muteBars, 0);
  assert.equal(preset.ladderOn, false);
  assert.equal(soundAt({ bar: 0, beat: 0, sub: 0 }, preset), null);
  assert.equal(soundAt({ bar: 0, beat: 1, sub: 0 }, preset), "accent");

  const encoded = parseHash("#bpm=60&meter=4%2F4&subdivision=eighth&accents=mama");
  assert.equal(encoded.meter, "4/4");
  assert.deepEqual(encoded.accents, preset.accents);

  const richer = parseHash("#bpm=96&meter=6/8&subdivision=triplet&swing=75&accents=annann&mute=2/2&ladder=140-100-5-2&volume=40&flash=1");
  assert.equal(richer.meter, "6/8");
  assert.equal(richer.subdivision, "triplet");
  assert.equal(richer.swing, 75);
  assert.equal(richer.playBars, 2);
  assert.equal(richer.muteBars, 2);
  assert.equal(richer.ladderOn, true);
  assert.deepEqual(ladderBpms(richer.ladderStart, richer.ladderTarget, richer.ladderStep), [140, 135, 130, 125, 120, 115, 110, 105, 100]);
  assert.equal(richer.ladderBars, 2);
  assert.equal(richer.volume, 40);
  assert.equal(richer.flash, true);
  assert.deepEqual(parseHash(`#${serializeHash(richer)}`), richer);
  assert.match(serializeHash(preset), /^bpm=60&meter=4\/4&subdivision=eighth&swing=50&accents=mama&mute=2\/0&ladder=off$/);

  assert.equal(parseHash("#chord=Am7"), null);
  assert.equal(parseHash(""), null);
  assert.deepEqual(parseHash("#meter=6/8").accents, defaultAccents("6/8"));
  assert.equal(parseHash("#meter=4/4&accents=nope").accents[0], "accent");
  assert.equal(parseHash("#mute=0").muteBars, 0);
  assert.equal(parseHash("#ladder=off").ladderOn, false);
  assert.equal(parseHash("#ladder=off").ladderStart, 80);
  const remembered = serializeHash({ ladderOn: false, ladderStart: 90, ladderTarget: 130, ladderStep: 4, ladderBars: 2 });
  assert.match(remembered, /ladder=off:90-130-4-2/);
  assert.equal(parseHash(`#${remembered}`).ladderOn, false);
  assert.equal(parseHash(`#${remembered}`).ladderStart, 90);

  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  assert.equal(loadState("", storage).bpm, 100);
  storage.setItem(STORAGE_KEY, JSON.stringify({ bpm: 144, meter: "3/4" }));
  assert.equal(loadState("", storage).bpm, 144);
  assert.equal(loadState("", storage).meter, "3/4");
  assert.equal(loadState(`#${HASH_EXAMPLE}`, storage).bpm, 60);
});

test("ladder tempo changes on the bar line while mute gaps keep the clock", () => {
  const events = walkClicks(2, {
    bpm: 40,
    meter: "4/4",
    subdivision: "quarter",
    ladderOn: true,
    ladderStart: 60,
    ladderTarget: 120,
    ladderStep: 60,
    ladderBars: 1,
  });
  assert.equal(events[0].bpm, 60);
  assert.equal(events[4].bpm, 120);
  near(events[4].time, 4);
  near(events[5].time, 4.5);
  assert.equal(events[0].sound, "accent");
});

test("docs publish the metronome hash, and the scheduler is not setInterval", () => {
  const agents = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.ok(agents.includes(HASH_EXAMPLE), "AGENTS.md deep link");
  assert.ok(readme.includes(HASH_EXAMPLE), "README deep link");
  for (const word of ["bpm", "meter", "subdivision", "swing", "accents", "mute", "ladder"]) {
    assert.ok(agents.includes(word), word);
    assert.ok(readme.includes(word), word);
  }
  const app = readFileSync(new URL("../metronome/app.js", import.meta.url), "utf8");
  assert.equal(app.includes("setInterval"), false);
  assert.match(app, /currentTime/);
  assert.match(app, /setTimeout/);
  const worker = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(worker, /guitar-tools-v9/);
  for (const file of ["./metronome/app.js", "./metronome/timing.js", "./metronome/metronome.css", "./chord/triads.js"]) {
    assert.ok(worker.includes(file), file);
  }
  const page = readFileSync(new URL("../metronome/index.html", import.meta.url), "utf8");
  assert.match(page, /lang="zh-Hant"/);
  assert.equal(/(?:href|src)=["']\//.test(page), false);
  assert.equal(/(?:href|src)=["']\//.test(app), false);
});
