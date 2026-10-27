import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { embedContext, mountEmbed, MAP_URL } from "../shared/embed.js";
import { TOOLS } from "../shared/registry.js";
import {
  HASH_EXAMPLE,
  MARKDOWN_HEADER,
  bpmChart,
  bpmSeries,
  createEntry,
  entriesToMarkdown,
  exerciseNames,
  formatClock,
  formatDay,
  formatDuration,
  formatStageWeek,
  fromBackup,
  loadEntries,
  mergeEntries,
  parseHash,
  pauseTimer,
  saveEntries,
  serializeHash,
  startTimer,
  startOfWeek,
  stopTimer,
  streakDays,
  summarize,
  timerElapsedMs,
  toBackup,
} from "../log/log.js";

const now = new Date(2026, 9, 26, 15, 0, 0);

function entry(overrides) {
  return createEntry(
    {
      id: overrides.id,
      date: overrides.date,
      durationSec: overrides.durationSec ?? 0,
      stage: overrides.stage ?? "",
      week: overrides.week ?? "",
      exercise: overrides.exercise ?? "",
      tool: overrides.tool ?? "",
      bpm: overrides.bpm ?? "",
      rating: overrides.rating ?? "",
      stuck: overrides.stuck ?? "",
      createdAt: overrides.createdAt,
    },
    now,
  );
}

test("hash prefills stage, week, exercise, tool, and bpm", () => {
  assert.equal(parseHash(""), null);
  assert.equal(parseHash("#"), null);
  assert.equal(parseHash("#chord=Am7&next=D7"), null);
  const parsed = parseHash(`#${HASH_EXAMPLE}`);
  assert.equal(parsed.stage, "2");
  assert.equal(parsed.week, "3");
  assert.equal(parsed.exercise, "八分音符");
  assert.equal(parsed.tool, "metronome");
  assert.equal(parsed.bpm, 60);
  assert.equal(parsed.rating, null);
  assert.equal(parsed.date, "");
  const encoded = parseHash("#stage=2&week=3&exercise=%E5%85%AB%E5%88%86%E9%9F%B3%E7%AC%A6&tool=Metronome&bpm=60&rating=4&stuck=%E7%AC%AC%202%20%E6%8B%8D");
  assert.equal(encoded.exercise, "八分音符");
  assert.equal(encoded.tool, "metronome");
  assert.equal(encoded.rating, 4);
  assert.equal(encoded.stuck, "第 2 拍");
  assert.equal(parseHash("#tool=piano&bpm=999").tool, "other");
  assert.equal(parseHash("#tool=piano&bpm=999").bpm, null);
  assert.equal(parseHash("#date=2026-02-31&minutes=1.5&seconds=30").date, "");
  assert.equal(parseHash("#date=2026-02-31&minutes=1.5&seconds=30").minutes, 1.5);
  const again = parseHash(`#${serializeHash(parsed)}`);
  assert.equal(again.exercise, "八分音符");
  assert.equal(again.bpm, 60);
  assert.match(serializeHash({ stage: "2", week: "3", exercise: "八分音符", tool: "metronome", bpm: 60 }), /stage=2/);
  assert.match(serializeHash({ stage: "2", week: "3", exercise: "八分音符", tool: "metronome", bpm: 60 }), /tool=metronome/);
});

test("today, this week, and streak use the local calendar", () => {
  assert.equal(formatDay(startOfWeek(now)), "2026-10-26");
  assert.equal(formatDay(startOfWeek(new Date(2026, 9, 25))), "2026-10-19");
  const entries = [
    entry({ id: "sun", date: "2026-10-25", durationSec: 600, exercise: "舊的" }),
    entry({ id: "mon", date: "2026-10-26", durationSec: 90, exercise: "八分音符", bpm: 60 }),
    entry({ id: "mon2", date: "2026-10-26", durationSec: 60, exercise: "八分音符", bpm: 72 }),
    entry({ id: "next", date: "2026-11-01", durationSec: 30, exercise: "八分音符", bpm: 80 }),
    entry({ id: "after", date: "2026-11-02", durationSec: 30, exercise: "八分音符", bpm: 90 }),
  ];
  const stats = summarize(entries, now);
  assert.equal(stats.todaySec, 150);
  assert.equal(stats.weekSec, 180);
  assert.equal(streakDays(entries, now), 2);
  assert.equal(streakDays(entries.filter((item) => item.date !== "2026-10-26"), now), 1);
  assert.equal(streakDays([entry({ id: "gap", date: "2026-10-24", exercise: "x", durationSec: 10 })], now), 0);
  assert.equal(streakDays([entry({ id: "only", date: "2026-10-26", exercise: "x", durationSec: 10 })], now), 1);
  const across = [
    entry({ id: "a", date: "2026-02-28", exercise: "跨月", durationSec: 10 }),
    entry({ id: "b", date: "2026-03-01", exercise: "跨月", durationSec: 10 }),
  ];
  assert.equal(streakDays(across, new Date(2026, 2, 1, 9)), 2);
  const sunday = new Date(2026, 9, 25, 12);
  const week = summarize(
    [
      entry({ id: "edge", date: "2026-10-19", durationSec: 15, exercise: "週一" }),
      entry({ id: "out", date: "2026-10-18", durationSec: 15, exercise: "週日外" }),
      entry({ id: "late", date: "2026-10-26", durationSec: 15, exercise: "下週" }),
    ],
    sunday,
  );
  assert.equal(week.weekSec, 15);
  assert.equal(week.todaySec, 0);
});

test("markdown export is a practice-log table", () => {
  assert.equal(formatStageWeek("2", "3"), "Stage 2 / 第 3 週");
  assert.equal(formatStageWeek("Stage 2", "3"), "Stage 2 / 第 3 週");
  assert.equal(formatStageWeek("和弦", "前奏"), "和弦 / 前奏");
  assert.equal(formatStageWeek("2", ""), "Stage 2");
  assert.equal(formatDuration(0), "0 分");
  assert.equal(formatDuration(45), "45 秒");
  assert.equal(formatDuration(90), "1 分 30 秒");
  assert.equal(formatDuration(3661), "1 小時 1 分 1 秒");
  assert.equal(formatClock(0), "0:00:00");
  assert.equal(formatClock(65000), "0:01:05");
  assert.equal(formatClock(3600000), "1:00:00");
  const entries = [
    entry({
      id: "b",
      date: "2026-10-26",
      durationSec: 90,
      stage: "2",
      week: "3",
      exercise: "八分音符",
      tool: "metronome",
      bpm: 60,
      rating: 3,
      stuck: "第 2 拍不穩",
      createdAt: "2026-10-26T02:00:00.000Z",
    }),
    entry({
      id: "a",
      date: "2026-10-25",
      durationSec: 60,
      stage: "2",
      week: "3",
      exercise: "Am7",
      tool: "chord",
      bpm: "",
      rating: "",
      stuck: "右手|左手\n換和弦",
      createdAt: "2026-10-25T02:00:00.000Z",
    }),
  ];
  const markdown = entriesToMarkdown(entries);
  assert.equal(
    markdown,
    [
      MARKDOWN_HEADER,
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| 2026-10-25 | Stage 2 / 第 3 週 | Am7 | 1 分 |  |  | 右手／左手 換和弦 |",
      "| 2026-10-26 | Stage 2 / 第 3 週 | 八分音符 | 1 分 30 秒 | 60 | 3 | 第 2 拍不穩 |",
    ].join("\n"),
  );
});

test("BPM series and chart follow one exercise", () => {
  const entries = [
    entry({ id: "1", date: "2026-10-24", exercise: "八分音符", bpm: 60, createdAt: "2026-10-24T01:00:00.000Z" }),
    entry({ id: "2", date: "2026-10-26", exercise: "音階", bpm: 80, createdAt: "2026-10-26T01:00:00.000Z" }),
    entry({ id: "3", date: "2026-10-25", exercise: "八分音符", bpm: 66, createdAt: "2026-10-25T01:00:00.000Z" }),
    entry({ id: "4", date: "2026-10-26", exercise: "八分音符", bpm: "", stuck: "沒有速度", createdAt: "2026-10-26T03:00:00.000Z" }),
  ];
  assert.deepEqual(
    bpmSeries(entries, "八分音符").map((point) => point.bpm),
    [60, 66],
  );
  assert.deepEqual(exerciseNames(entries), ["音階", "八分音符"]);
  const chart = bpmChart(bpmSeries(entries, "八分音符"));
  assert.match(chart.svg, /<svg/);
  assert.match(chart.svg, /60/);
  assert.match(chart.svg, /66/);
  assert.match(chart.svg, /10\/24/);
  assert.match(chart.summary, /60 BPM/);
  assert.equal(chart.total, 2);
  const nasty = bpmChart([{ id: "x", date: "2026-10-01", bpm: 50 }, { id: "y", date: "1<2 & 3", bpm: 70 }]);
  assert.equal(nasty.svg.includes("1<2"), false);
  assert.match(nasty.svg, /1&lt;2 &amp; 3/);
  assert.equal(bpmChart([]).svg, "");
});

test("JSON backup merges by id and ignores a broken store", () => {
  const first = entry({ id: "same", date: "2026-10-26", exercise: "八分音符", bpm: 60, stuck: "趕拍", durationSec: 30 });
  const second = entry({ id: "other", date: "2026-10-25", exercise: "Am7", durationSec: 45, stuck: "換指" });
  const replacement = entry({ id: "same", date: "2026-10-26", exercise: "八分音符", bpm: 72, stuck: "趕拍", durationSec: 40 });
  const merged = mergeEntries([first, second], fromBackup(JSON.stringify(toBackup([replacement]))));
  assert.deepEqual(
    merged.map((item) => [item.id, item.bpm, item.durationSec]),
    [
      ["other", null, 45],
      ["same", 72, 40],
    ],
  );
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  saveEntries([first], storage);
  assert.equal(loadEntries(storage).length, 1);
  storage.setItem("guitar-tools.log.v1", "{");
  assert.deepEqual(loadEntries(storage), []);
  assert.throws(() => fromBackup("nope"), /讀不起來/);
  assert.deepEqual(fromBackup("[]"), []);
  assert.equal(createEntry({ exercise: "", minutes: 0, seconds: 0 }, now).durationSec, 0);
});

test("timer accumulates while running and resets on stop", () => {
  let timer = startTimer(null, 1_000);
  assert.equal(timerElapsedMs(timer, 4_000), 3_000);
  timer = pauseTimer(timer, 4_000);
  assert.equal(timerElapsedMs(timer, 9_000), 3_000);
  timer = startTimer(timer, 5_000);
  assert.equal(timerElapsedMs(timer, 8_000), 6_000);
  const stopped = stopTimer(timer, 8_000);
  assert.equal(stopped.elapsedMs, 6_000);
  assert.equal(stopped.timer.status, "idle");
  assert.equal(timerElapsedMs(stopped.timer, 20_000), 0);
  assert.equal(pauseTimer(stopped.timer, 20_000).status, "idle");
});

test("log is live, embeddable, and the metronome can open it", () => {
  assert.equal(TOOLS.find((tool) => tool.slug === "log").status, "live");
  assert.deepEqual(
    TOOLS.filter((tool) => tool.status === "soon").map((tool) => tool.slug),
    [],
  );
  const worker = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(worker, /guitar-tools-v10/);
  for (const file of ["./log/app.js", "./log/log.js", "./log/log.css", "./shared/embed.js", "./shared/embed-boot.js"]) {
    assert.ok(worker.includes(file), file);
  }
  const agents = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.ok(agents.includes(HASH_EXAMPLE));
  assert.ok(readme.includes(HASH_EXAMPLE));
  assert.match(agents, /from=map/);
  assert.match(agents, /回學習地圖/);
  const page = readFileSync(new URL("../log/index.html", import.meta.url), "utf8");
  assert.match(page, /lang="zh-Hant"/);
  assert.equal(/(?:href|src)=["']\//.test(page), false);
  assert.equal(/frame-ancestors|X-Frame-Options/i.test(page), false);
  const fretboard = readFileSync(new URL("../fretboard/index.html", import.meta.url), "utf8");
  const fretboardApp = readFileSync(new URL("../fretboard/app.js", import.meta.url), "utf8");
  assert.match(fretboard, /embed-boot\.js/);
  assert.match(fretboardApp, /pwa\.js/);
  const metro = readFileSync(new URL("../metronome/index.html", import.meta.url), "utf8");
  const metroApp = readFileSync(new URL("../metronome/app.js", import.meta.url), "utf8");
  assert.match(metro, /記錄這次練習/);
  assert.match(metro, /tool=metronome/);
  assert.match(metroApp, /log-practice/);
  assert.match(metroApp, /"metronome"/);
  assert.equal(metroApp.includes("setInterval"), false);

  const top = { name: "top" };
  assert.deepEqual(embedContext({ self: top, top, location: { search: "" } }), {
    inFrame: false,
    fromMap: false,
    showBack: false,
  });
  assert.equal(embedContext({ self: { name: "frame" }, top, location: { search: "?from=map" } }).showBack, true);
  assert.equal(embedContext({ self: top, top, location: { search: "?from=map" } }).inFrame, false);
  assert.equal(
    embedContext({
      get self() {
        throw new Error("cross-origin");
      },
      top,
      location: { search: "" },
    }).inFrame,
    true,
  );

  const elements = [];
  const body = {
    classList: { add() {} },
    prepend(node) {
      elements.unshift(node);
    },
  };
  const doc = {
    body,
    documentElement: { classList: { add() {} } },
    querySelector(selector) {
      return elements.find((node) => node.className === selector.slice(1)) ?? null;
    },
    createElement() {
      return {
        className: "",
        href: "",
        textContent: "",
        target: "",
        removeAttribute(name) {
          if (name === "target") this.target = "";
        },
      };
    },
  };
  const ctx = mountEmbed(doc, { self: { name: "frame" }, top, location: { search: "" } });
  assert.equal(ctx.inFrame, true);
  assert.equal(elements[0].textContent, "← 回學習地圖");
  assert.equal(elements[0].href, MAP_URL);
  assert.equal(elements[0].target, "_top");
  const plain = [];
  const topDoc = {
    ...doc,
    body: { classList: { add() {} }, prepend(node) { plain.unshift(node); } },
    querySelector() {
      return plain.find((node) => node.className === "embed-back") ?? null;
    },
  };
  mountEmbed(topDoc, { self: top, top, location: { search: "?from=map" } });
  assert.equal(plain[0].target, "");
  const none = [];
  mountEmbed(
    {
      ...topDoc,
      body: { classList: { add() {} }, prepend(node) { none.unshift(node); } },
      querySelector() {
        return null;
      },
    },
    { self: top, top, location: { search: "" } },
  );
  assert.equal(none.length, 0);
});
