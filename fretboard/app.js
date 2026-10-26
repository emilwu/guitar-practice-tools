import { playNotes } from "../shared/audio.js";
import { neckSvg } from "../shared/diagram.js";
import "../shared/pwa.js";
import { mountToneSelect } from "../shared/tone.js";
import {
  CANONICAL_DEGREES,
  NATURAL_PCS,
  SCALES,
  SHAPES,
  gradeInterval,
  gradeName,
  gradeTaps,
  intervalFromSemitones,
  makeQuestion,
  noteName,
  pcFromName,
  scaleById,
} from "./logic.js";
import { loadSettings, normalizeSettings, saveSettings, serializeHash } from "./state.js";
import { emptyStats, heatmapCells, loadStats, noteRows, recordStat, saveStats, stringRows } from "./stats.js";

const PIANO = { z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11 };
const INDEX_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];
const PC_KEY = ["z", "s", "x", "d", "c", "v", "g", "b", "h", "n", "j", "m"];
const STRING_NAME = { 6: "E", 5: "A", 4: "D", 3: "G", 2: "B", 1: "E" };
const MODES = [
  ["find", "找音"],
  ["name", "識音"],
  ["interval", "音程"],
  ["scale", "音階"],
];

const settings = loadSettings(location.hash, localStorage);
let stats = loadStats(localStorage);
let question = null;
let taps = [];
let chosen = "";
let locked = false;
let revealed = false;
let running = false;
let ended = false;
let feedback = "";
let resetArmed = false;
let questionStarted = 0;
let lastMark = 0;
let roundEndsAt = 0;
let timerId = 0;
const session = { correct: 0, wrong: 0, done: 0 };

const app = document.querySelector("#app");
mountToneSelect(document.querySelector("#tone-slot"));

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function sameSpot(a, b) {
  return a && b && a.stringIndex === b.stringIndex && a.fret === b.fret;
}

function coerceKey() {
  if (settings.mode !== "scale" || !settings.naturals) return;
  if (!NATURAL_PCS.includes(pcFromName(settings.key))) settings.key = "A";
}

function writeHash() {
  const hash = serializeHash(settings);
  const next = `${location.pathname}${location.search}${hash ? `#${hash}` : ""}`;
  const current = `${location.pathname}${location.search}${location.hash}`;
  if (current !== next) history.replaceState(null, "", next);
}

function commitSettings() {
  coerceKey();
  const next = normalizeSettings(settings);
  Object.assign(settings, next);
  settings.strings = next.strings.slice();
  settings.degrees = next.degrees.slice();
  saveSettings(settings, localStorage);
  writeHash();
  restart();
}

function commitStat(entry) {
  stats = recordStat(stats, entry);
  saveStats(localStorage, stats);
}

function hear(notes) {
  if (!settings.sound || !notes?.length) return;
  try {
    playNotes(notes.map((note) => ({ fret: note.fret, midi: note.midi, string: note.string })));
  } catch {
    /* A browser can refuse audio until a gesture settles. The score still counts. */
  }
}

function clearTimer() {
  if (timerId) clearInterval(timerId);
  timerId = 0;
}

function restart() {
  clearTimer();
  session.correct = 0;
  session.wrong = 0;
  session.done = 0;
  feedback = "";
  ended = false;
  roundEndsAt = 0;
  question = null;
  taps = [];
  chosen = "";
  locked = false;
  revealed = false;
  if (settings.timer > 0) running = false;
  else {
    running = true;
    deal();
    return;
  }
  render();
}

function deal() {
  if (roundEndsAt && Date.now() >= roundEndsAt) {
    endRound();
    return;
  }
  question = makeQuestion(settings, Math.random);
  taps = [];
  chosen = "";
  locked = false;
  revealed = false;
  questionStarted = performance.now();
  lastMark = questionStarted;
  feedback = question ? "" : "這個範圍裡沒有題目。把品格或弦放寬一點。";
  render();
}

function startRound() {
  session.correct = 0;
  session.wrong = 0;
  session.done = 0;
  ended = false;
  running = true;
  roundEndsAt = Date.now() + settings.timer * 1000;
  clearTimer();
  timerId = setInterval(tick, 250);
  deal();
}

function tick() {
  if (!running || !roundEndsAt) return;
  if (Date.now() >= roundEndsAt) endRound();
  else paintTimer();
}

function endRound() {
  clearTimer();
  running = false;
  ended = true;
  roundEndsAt = 0;
  locked = true;
  feedback = `時間到。完成 ${session.done} 題，對 ${session.correct}，錯 ${session.wrong}。`;
  render();
}

function paintTimer() {
  const node = document.querySelector("#timer");
  if (!node) return;
  node.textContent = clockLabel();
}

function clockLabel() {
  if (settings.timer <= 0) return "不計時";
  if (!running || !roundEndsAt) return formatClock(settings.timer * 1000);
  return formatClock(roundEndsAt - Date.now());
}

function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function reactionMs() {
  const now = performance.now();
  const from = question && (question.type === "find" || question.type === "locate") ? lastMark : questionStarted;
  lastMark = now;
  return now - from;
}

function modeHelp() {
  if (settings.mode === "name") return "指板會亮一個點，從十二個音名裡選。升記號和降記號都算對。";
  if (settings.mode === "interval" && settings.imode === "name") return "兩個點，選出音程。b5 和 #4、#5 和 b6 算同一個。";
  if (settings.mode === "interval") return "金色的點是根音。題目給級數，把那個音在範圍裡點出來。";
  if (settings.mode === "scale") return "選調、音階和 CAGED 框，先靠記憶把框點滿，再對答案。";
  return "畫面上會出現一個音名，把範圍裡每一格都點出來。";
}

function rangeLabel() {
  const names = settings.strings.map((string) => `${string} ${STRING_NAME[string]}`).join("、");
  return `現在是 ${names}，第 ${settings.fretMin}–${settings.fretMax} 格。指板可以左右滑。`;
}

function foundCount() {
  if (!question) return 0;
  return question.targets.filter((target) => taps.some((tap) => sameSpot(tap, target) && tap.correct !== false)).length;
}

function promptHtml() {
  if (ended) {
    return `<p class="hint">${esc(modeHelp())}</p><p class="prompt-note">時間到</p><p>這一輪完成 ${session.done} 題。</p>`;
  }
  if (settings.timer > 0 && !running) {
    return `<p class="hint">${esc(modeHelp())}</p><p class="prompt-note">${settings.timer} 秒</p><p>${esc(rangeLabel())}</p>`;
  }
  if (!question) return `<p class="hint">${esc(modeHelp())}</p><p>${esc(rangeLabel())}</p>`;
  if (question.type === "find") {
    const name = noteName(question.pc, settings.spell);
    return `<p class="hint">${esc(modeHelp())}</p><p class="prompt-note">${esc(name)}</p><p>已找到 ${foundCount()}／${question.targets.length}。${esc(rangeLabel())}</p>`;
  }
  if (question.type === "name") {
    return `<p class="hint">${esc(modeHelp())}</p><p class="prompt-note">哪個音</p><p>看亮起來的那一格。</p>`;
  }
  if (question.type === "locate") {
    const root = question.root;
    const rootName = noteName(root.pc, settings.spell);
    return `<p class="hint">根音在第 ${root.string} 弦第 ${root.fret} 格（${esc(rootName)}）。</p><p class="prompt-note">${esc(question.degree)}</p><p>已找到 ${foundCount()}／${question.targets.length}。</p>`;
  }
  if (question.type === "iname") {
    return `<p class="hint">${esc(modeHelp())}</p><p class="prompt-note">音程</p><p>金色是較低的音，選出到另一個點的級數。</p>`;
  }
  const box = question.box;
  const keyLabel = noteName(box.keyPc, settings.spell);
  const fit = box.fitsRange ? "" : `這個框在第 ${box.fretMin}–${box.fretMax} 格，沒有完全落在你選的範圍裡，所以整框都留著。`;
  const root = box.root ? `根音在第 ${box.root.string} 弦第 ${box.root.fret} 格。` : "";
  return `<p class="hint">${esc(modeHelp())}</p><p class="prompt-note">${esc(keyLabel)}</p><p>${esc(box.scaleName)} · ${esc(box.shapeName)} · 第 ${box.box} 框。${esc(root)} ${esc(fit)}</p>`;
}

function statusHtml() {
  return `<span>本輪 ${session.done} 題 · 對 ${session.correct} · 錯 ${session.wrong}</span><span class="timer" id="timer">${esc(clockLabel())}</span>`;
}

function primaryLabel() {
  if (ended) return "再練一輪";
  if (settings.timer > 0 && !running) return `開始 ${settings.timer} 秒`;
  if (!question) return "出題";
  if (!locked) return question.type === "scale" ? "對答案" : "看答案";
  return "下一題";
}

function keyHint() {
  if (question?.type === "name") return "鍵盤：z 列當鋼琴，z 是 C，黑鍵是 s d g h j。Enter 看答案或下一題。";
  if (question?.type === "iname") return "鍵盤：1 到 = 對應下面的音程按鈕。Enter 看答案或下一題。";
  if (question?.type === "scale") return "鍵盤：Enter 對答案或下一題。Backspace 清掉目前的選擇。";
  return "鍵盤：Enter 看答案或下一題。";
}

function degreeOf(cell) {
  return intervalFromSemitones(cell.pc - (question?.pc ?? 0)).label;
}

function boardTargets() {
  if (!question || !running || ended) return [];
  return question.cells.map((cell) => {
    const selected = taps.find((tap) => sameSpot(tap, cell));
    const isTarget = question.targets.some((target) => sameSpot(target, cell));
    const isRoot = question.root && sameSpot(question.root, cell) && question.type !== "find";
    let state = "";
    let label = "";
    if (question.type === "scale") {
      if (!revealed) {
        if (selected) state = "on";
      } else if (isTarget && selected) {
        state = "good";
        label = cell.degree || degreeOf(cell);
      } else if (isTarget) {
        state = "miss";
        label = cell.degree || degreeOf(cell);
      } else if (selected) {
        state = "bad";
        label = degreeOf(cell);
      }
    } else if (question.type === "name") {
      state = revealed ? (chosen && gradeName(question.pc, chosen) ? "good" : "bad") : "lit";
      if (revealed) label = noteName(question.pc, settings.spell);
    } else if (question.type === "iname") {
      if (isRoot) {
        state = "root";
        label = "R";
      } else {
        state = revealed ? (chosen && gradeInterval(question.semitones, chosen) ? "good" : "bad") : "lit";
        if (revealed) label = question.degree;
      }
    } else if (isRoot && question.type === "locate") {
      state = "root";
      label = "R";
    } else if (selected?.correct) {
      state = "good";
      label = question.type === "locate" ? question.degree : noteName(question.pc, settings.spell);
    } else if (selected) {
      state = "bad";
      label = noteName(cell.pc, settings.spell);
    } else if (revealed && isTarget) {
      state = "miss";
      label = question.type === "locate" ? question.degree : noteName(question.pc, settings.spell);
    }
    const aria = `${cell.string}弦${cell.fret}格${label ? ` ${label}` : ""}`;
    return { ...cell, state, label, aria };
  });
}

function boardHtml() {
  const targets = boardTargets();
  const span = question?.type === "scale"
    ? { fretMin: question.box.fretMin, fretMax: question.box.fretMax }
    : { fretMin: settings.fretMin, fretMax: settings.fretMax };
  const fretCount = Math.max(12, span.fretMax, ...targets.map((target) => target.fret));
  const highlight = span.fretMin > 0 || span.fretMax < fretCount ? span : null;
  const label = question?.type === "find"
    ? `指板。找出所有的 ${noteName(question.pc, settings.spell)}。`
    : "指板";
  return `<div class="neck-scroll">${neckSvg({
    targets,
    fretCount,
    highlight,
    ariaLabel: label,
    role: "group",
    fretW: 54,
    stringGap: 46,
    left: 86,
    hitR: 18,
  })}</div>`;
}

function answerButtons() {
  if (!question || !running || ended) return "";
  if (question.type === "name") {
    const names = settings.spell === "flat"
      ? ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
      : ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    return `<div class="answer-grid">${names
      .map((name, index) => {
        const pc = pcFromName(name);
        let cls = "answer";
        if (revealed && pc === question.pc) cls += " is-good";
        else if (revealed && pcFromName(chosen) != null && pc === pcFromName(chosen)) cls += " is-bad";
        return `<button type="button" class="${cls}" data-answer="${esc(name)}">${esc(name)}<kbd class="desktop-only">${PC_KEY[index]}</kbd></button>`;
      })
      .join("")}</div><p class="hint desktop-only">${esc(keyHint())}</p>`;
  }
  if (question.type === "iname") {
    const degrees = settings.degrees;
    return `<div class="answer-grid">${degrees
      .map((degree, index) => {
        let cls = "answer";
        if (revealed && degree === question.degree) cls += " is-good";
        else if (revealed && degree === chosen) cls += " is-bad";
        const kbd = INDEX_KEYS[index] ? `<kbd class="desktop-only">${esc(INDEX_KEYS[index])}</kbd>` : "";
        return `<button type="button" class="${cls}" data-answer="${esc(degree)}">${esc(degree)}${kbd}</button>`;
      })
      .join("")}</div><p class="hint desktop-only">${esc(keyHint())}</p>`;
  }
  return `<p class="hint desktop-only">${esc(keyHint())}</p>`;
}

function actionsHtml() {
  const clear = question?.type === "scale" && !locked ? `<button type="button" class="quiet" data-action="clear">清除選擇</button>` : "";
  return `<button type="button" class="pill" data-action="primary">${esc(primaryLabel())}</button>${clear}`;
}

function chip(text, attrs, on, extra = "") {
  const data = Object.entries(attrs)
    .map(([key, value]) => ` data-${key}="${esc(value)}"`)
    .join("");
  return `<button type="button" class="chip${on ? " is-on" : ""}" aria-pressed="${on ? "true" : "false"}"${data}>${esc(text)}${extra}</button>`;
}

function optionsHtml() {
  const strings = [6, 5, 4, 3, 2, 1]
    .map((string) => chip(`${string} ${STRING_NAME[string]}`, { string }, settings.strings.includes(string)))
    .join("");
  const preset = (min, max) => settings.fretMin === min && settings.fretMax === max;
  const frets = [
    chip("0–12", { "fret-preset": "0-12" }, preset(0, 12)),
    chip("0–15", { "fret-preset": "0-15" }, preset(0, 15)),
  ].join("");
  const timers = [0, 30, 60, 120];
  if (!timers.includes(settings.timer)) timers.push(settings.timer);
  const timerChips = timers
    .map((seconds) => chip(seconds ? `${seconds} 秒` : "不計時", { timer: seconds }, settings.timer === seconds))
    .join("");
  let scale = "";
  if (settings.mode === "scale") {
    const keyPcs = settings.naturals ? NATURAL_PCS : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const keys = keyPcs
      .map((pc) => {
        const name = noteName(pc, settings.spell);
        return chip(name, { key: name }, pcFromName(settings.key) === pc);
      })
      .join("");
    const scales = SCALES.map((item) => chip(item.name, { scale: item.id }, settings.scale === item.id)).join("");
    const shapes = SHAPES.map((item) => chip(`${item.name} · 第 ${item.box} 框`, { shape: item.id }, settings.shape === item.id)).join("");
    scale = `<div class="option-block"><p>調</p><div class="row">${keys}</div></div>
      <div class="option-block"><p>音階</p><div class="row">${scales}</div></div>
      <div class="option-block"><p>CAGED 框</p><div class="row">${shapes}</div><p class="hint">五聲和藍調的第 1 框，根音在第 6 弦。</p></div>`;
  }
  let degrees = "";
  if (settings.mode === "interval") {
    const degreeChips = CANONICAL_DEGREES.map((degree) => chip(degree, { degree }, settings.degrees.includes(degree))).join("");
    degrees = `<div class="option-block"><p>要練的級數</p><div class="row">${degreeChips}</div></div>`;
  }
  return `<div class="option-block"><p>弦（1 是高音 E）</p><div class="row">${strings}</div></div>
    <div class="option-block"><p>品格</p><div class="row">${frets}</div>
      <div class="fret-fields" style="margin-top:8px">
        <label>從 <input id="fret-min" type="number" min="0" max="15" inputmode="numeric" value="${settings.fretMin}"> 格</label>
        <label>到 <input id="fret-max" type="number" min="0" max="15" inputmode="numeric" value="${settings.fretMax}"> 格</label>
      </div>
    </div>
    <div class="option-block"><p>計時</p><div class="row">${timerChips}</div></div>
    <div class="row">
      ${chip("只練自然音", { naturals: "toggle" }, settings.naturals)}
      ${chip("升記號", { spell: "sharp" }, settings.spell === "sharp")}
      ${chip("降記號", { spell: "flat" }, settings.spell === "flat")}
      ${chip("答題時出聲", { sound: "toggle" }, settings.sound)}
    </div>
    ${scale}${degrees}`;
}

function percent(accuracy) {
  if (accuracy == null) return "—";
  return `${Math.round(accuracy * 100)}%`;
}

function seconds(ms) {
  if (ms == null) return "—";
  return `${(ms / 1000).toFixed(1)} 秒`;
}

function table(headers, rows) {
  if (!rows.length) return `<p class="muted">還沒有紀錄。</p>`;
  const head = headers.map((header) => `<th>${esc(header)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<table class="stats-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function statsHtml() {
  const notes = noteRows(stats, settings.spell);
  const strings = stringRows(stats);
  const cells = heatmapCells(stats);
  const weak = cells.filter((cell) => cell.weakness > 0).slice(0, 5);
  const resetLabel = resetArmed ? "再按一次就清除" : "清除統計";
  let heat = `<p class="muted">還沒有紀錄。答幾題之後，這裡會標出比較不穩的格子。</p>`;
  if (cells.length) {
    const markers = cells.map((cell) => ({
      stringIndex: cell.stringIndex,
      fret: cell.fret,
      heat: cell.weakness,
      kind: "scale",
      label: "",
    }));
    const fretCount = Math.max(12, ...cells.map((cell) => cell.fret));
    const weakText = weak.length
      ? `<ul class="weak-list">${weak
          .map(
            (cell) =>
              `<li>第 ${cell.string} 弦第 ${cell.fret} 格，正確率 ${percent(cell.accuracy)}，平均 ${seconds(cell.avgMs)}</li>`,
          )
          .join("")}</ul>`
      : `<p>目前沒有明顯的弱點。</p>`;
    heat = `<div class="neck-scroll">${neckSvg({
      markers,
      fretCount,
      ariaLabel: "弱點熱圖",
      fretW: 42,
      stringGap: 28,
      left: 64,
    })}</div>
      <div class="legend"><span><i class="swatch heat-strong"></i>比較穩</span><span><i class="swatch heat-weak"></i>比較不穩</span></div>
      ${weakText}`;
  }
  return `<h2>弱點熱圖</h2>
    <p class="hint">顏色看正確率。綠是比較穩，紅是比較不穩。時間是平均反應。</p>
    <div class="stats-grid">
      <div class="span-2">${heat}</div>
      <div><h3>各音</h3>${table(["音", "正確率", "平均", "題數"], notes.map((row) => [row.name, percent(row.accuracy), seconds(row.avgMs), String(row.attempts)]))}</div>
      <div><h3>各弦</h3>${table(["弦", "正確率", "平均", "題數"], strings.map((row) => [`${row.string} ${STRING_NAME[row.string]}`, percent(row.accuracy), seconds(row.avgMs), String(row.attempts)]))}</div>
    </div>
    <p style="margin-top:12px"><button type="button" class="quiet" data-action="reset">${esc(resetLabel)}</button></p>`;
}

function modesHtml() {
  const tabs = MODES.map(([id, label]) => {
    const on = settings.mode === id;
    return `<button type="button" class="chip${on ? " is-on" : ""}" role="tab" data-mode="${id}" aria-selected="${on ? "true" : "false"}">${label}</button>`;
  }).join("");
  if (settings.mode !== "interval") return tabs;
  const sub = [
    chip("找音程", { imode: "locate" }, settings.imode !== "name"),
    chip("說出音程", { imode: "name" }, settings.imode === "name"),
  ].join("");
  return `${tabs}<div class="row" style="margin-top:8px">${sub}</div>`;
}

function renderPlay() {
  document.querySelector("#prompt").innerHTML = promptHtml();
  document.querySelector("#status-line").innerHTML = statusHtml();
  document.querySelector("#feedback").textContent = feedback;
  document.querySelector("#board").innerHTML = boardHtml();
  document.querySelector("#actions").innerHTML = actionsHtml();
  document.querySelector("#answers").innerHTML = answerButtons();
  document.querySelector("#stats").innerHTML = statsHtml();
}

function render() {
  document.querySelector("#modes").innerHTML = modesHtml();
  document.querySelector("#options").innerHTML = optionsHtml();
  renderPlay();
}

function missedTargets() {
  return question.targets.filter((target) => !taps.some((tap) => sameSpot(tap, target)));
}

function revealFind() {
  for (const target of missedTargets()) {
    commitStat({
      pc: question.pc,
      string: target.string,
      stringIndex: target.stringIndex,
      fret: target.fret,
      correct: false,
      ms: null,
    });
    session.wrong += 1;
  }
  session.done += 1;
  const result = gradeTaps(question.targets, taps);
  feedback = result.foundAll ? "都找到了。" : `還缺 ${result.missed} 個。虛線圈是漏掉的。`;
  revealed = true;
  locked = true;
}

function revealScale() {
  const result = gradeTaps(question.targets, taps);
  const pieces = Math.max(1, result.correct + result.wrong + result.missed);
  const share = (performance.now() - questionStarted) / pieces;
  for (const target of question.targets) {
    const hit = taps.some((tap) => sameSpot(tap, target));
    commitStat({ pc: target.pc, string: target.string, stringIndex: target.stringIndex, fret: target.fret, correct: hit, ms: share });
  }
  for (const tap of taps) {
    if (question.targets.some((target) => sameSpot(target, tap))) continue;
    commitStat({ pc: tap.pc, string: tap.string, stringIndex: tap.stringIndex, fret: tap.fret, correct: false, ms: share });
  }
  session.correct += result.correct;
  session.wrong += result.wrong + result.missed;
  session.done += 1;
  hear(question.targets);
  feedback = `對 ${result.correct}、多按 ${result.wrong}、漏 ${result.missed}。`;
  revealed = true;
  locked = true;
}

function answerName(name) {
  if (!question || locked || question.type !== "name") return;
  const correct = gradeName(question.pc, name);
  chosen = name;
  commitStat({
    pc: question.pc,
    string: question.position.string,
    stringIndex: question.position.stringIndex,
    fret: question.position.fret,
    correct,
    ms: performance.now() - questionStarted,
  });
  if (correct) session.correct += 1;
  else session.wrong += 1;
  session.done += 1;
  locked = true;
  revealed = true;
  hear([question.position]);
  feedback = correct ? "對了。" : `不是，這是 ${noteName(question.pc, settings.spell)}。`;
  renderPlay();
}

function answerInterval(label) {
  if (!question || locked || question.type !== "iname") return;
  const correct = gradeInterval(question.semitones, label);
  chosen = label;
  commitStat({
    pc: question.pc,
    string: question.other.string,
    stringIndex: question.other.stringIndex,
    fret: question.other.fret,
    correct,
    ms: performance.now() - questionStarted,
  });
  if (correct) session.correct += 1;
  else session.wrong += 1;
  session.done += 1;
  locked = true;
  revealed = true;
  hear([question.root, question.other]);
  feedback = correct ? "對了。" : `不是，這是 ${question.degree}。`;
  renderPlay();
}

function onTap(stringIndex, fret) {
  if (!question || locked || !running || ended) return;
  const cell = question.cells.find((item) => item.stringIndex === stringIndex && item.fret === fret);
  if (!cell) return;
  if (question.type === "scale") {
    const index = taps.findIndex((tap) => sameSpot(tap, cell));
    if (index >= 0) taps.splice(index, 1);
    else taps.push(cell);
    feedback = `已點 ${taps.length} 個。`;
    renderPlay();
    return;
  }
  if (question.type === "name" || question.type === "iname") {
    hear([cell]);
    return;
  }
  if (question.type === "locate" && sameSpot(question.root, cell)) {
    feedback = "這是根音。";
    hear([cell]);
    renderPlay();
    return;
  }
  if (taps.some((tap) => sameSpot(tap, cell))) return;
  const correct = question.targets.some((target) => sameSpot(target, cell));
  taps.push({ ...cell, correct });
  commitStat({
    pc: question.pc,
    string: cell.string,
    stringIndex,
    fret,
    correct,
    ms: reactionMs(),
  });
  if (correct) session.correct += 1;
  else session.wrong += 1;
  hear([cell]);
  if (gradeTaps(question.targets, taps).foundAll) {
    locked = true;
    revealed = true;
    session.done += 1;
    feedback = `完成，${question.targets.length} 個位置都找到了。`;
  } else {
    feedback = correct ? `對了。還缺 ${question.targets.length - foundCount()} 個。` : `不是，這格是 ${noteName(cell.pc, settings.spell)}。`;
  }
  renderPlay();
}

function primary() {
  resetArmed = false;
  if (ended) {
    if (settings.timer > 0) startRound();
    else restart();
    return;
  }
  if (settings.timer > 0 && !running) {
    startRound();
    return;
  }
  if (!question) {
    deal();
    return;
  }
  if (!locked) {
    if (question.type === "name") answerName("");
    else if (question.type === "iname") answerInterval("");
    else if (question.type === "scale") {
      revealScale();
      renderPlay();
    } else {
      revealFind();
      renderPlay();
    }
    return;
  }
  deal();
}

function onReset() {
  if (!resetArmed) {
    resetArmed = true;
    feedback = "再按一次就清除統計。";
    render();
    return;
  }
  resetArmed = false;
  stats = emptyStats();
  saveStats(localStorage, stats);
  feedback = "統計已清除。";
  render();
}

app.addEventListener("click", (event) => {
  const hit = event.target.closest("[data-fret]");
  if (hit && app.contains(hit)) {
    resetArmed = false;
    onTap(Number(hit.dataset.stringIndex), Number(hit.dataset.fret));
    return;
  }
  const button = event.target.closest("button");
  if (!button || !app.contains(button)) return;
  if (button.dataset.answer != null) {
    resetArmed = false;
    if (locked) return;
    if (question?.type === "name") answerName(button.dataset.answer);
    else answerInterval(button.dataset.answer);
    return;
  }
  if (button.dataset.action === "primary") {
    primary();
    return;
  }
  if (button.dataset.action === "clear") {
    resetArmed = false;
    taps = [];
    feedback = "已清除選擇。";
    renderPlay();
    return;
  }
  if (button.dataset.action === "reset") {
    onReset();
    return;
  }
  resetArmed = false;
  if (button.dataset.mode) {
    settings.mode = button.dataset.mode;
    commitSettings();
    return;
  }
  if (button.dataset.imode) {
    settings.imode = button.dataset.imode;
    settings.mode = "interval";
    commitSettings();
    return;
  }
  if (button.dataset.string) {
    const string = Number(button.dataset.string);
    if (settings.strings.includes(string)) {
      if (settings.strings.length === 1) return;
      settings.strings = settings.strings.filter((item) => item !== string);
    } else settings.strings = [...settings.strings, string].sort((a, b) => b - a);
    commitSettings();
    return;
  }
  if (button.dataset.fretPreset) {
    const [min, max] = button.dataset.fretPreset.split("-").map(Number);
    settings.fretMin = min;
    settings.fretMax = max;
    commitSettings();
    return;
  }
  if (button.dataset.timer != null) {
    settings.timer = Number(button.dataset.timer);
    commitSettings();
    return;
  }
  if (button.dataset.spell) {
    settings.spell = button.dataset.spell;
    commitSettings();
    return;
  }
  if (button.dataset.naturals) {
    settings.naturals = !settings.naturals;
    commitSettings();
    return;
  }
  if (button.dataset.sound) {
    settings.sound = !settings.sound;
    commitSettings();
    return;
  }
  if (button.dataset.key) {
    settings.key = button.dataset.key;
    commitSettings();
    return;
  }
  if (button.dataset.scale) {
    settings.scale = scaleById(button.dataset.scale)?.id || settings.scale;
    commitSettings();
    return;
  }
  if (button.dataset.shape) {
    settings.shape = button.dataset.shape;
    commitSettings();
    return;
  }
  if (button.dataset.degree) {
    const degree = button.dataset.degree;
    if (settings.degrees.includes(degree)) {
      if (settings.degrees.length === 1) return;
      settings.degrees = CANONICAL_DEGREES.filter((item) => item !== degree && settings.degrees.includes(item));
    } else settings.degrees = CANONICAL_DEGREES.filter((item) => item === degree || settings.degrees.includes(item));
    commitSettings();
  }
});

app.addEventListener("change", (event) => {
  if (event.target.id !== "fret-min" && event.target.id !== "fret-max") return;
  const min = Number(document.querySelector("#fret-min").value);
  const max = Number(document.querySelector("#fret-max").value);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return;
  settings.fretMin = min;
  settings.fretMax = max;
  commitSettings();
});

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key;
  const typing = event.target.closest("input, textarea");
  if (typing) return;
  const onButton = event.target.closest("button, a");
  if ((key === "Enter" || key === " ") && onButton) return;
  if (key === "Enter" || key === " ") {
    event.preventDefault();
    primary();
    return;
  }
  if (key === "Backspace" && question?.type === "scale" && !locked) {
    event.preventDefault();
    taps = [];
    feedback = "已清除選擇。";
    renderPlay();
    return;
  }
  const pc = PIANO[key.toLowerCase()];
  if (question?.type === "name" && !locked && key.length === 1 && pc != null) {
    event.preventDefault();
    answerName(noteName(pc, "sharp"));
    return;
  }
  if (question?.type === "iname" && !locked) {
    const index = INDEX_KEYS.indexOf(key);
    if (index >= 0 && settings.degrees[index]) {
      event.preventDefault();
      answerInterval(settings.degrees[index]);
    }
  }
});

window.addEventListener("hashchange", () => {
  const next = loadSettings(location.hash, localStorage);
  Object.assign(settings, next);
  settings.strings = next.strings.slice();
  settings.degrees = next.degrees.slice();
  saveSettings(settings, localStorage);
  restart();
});

saveSettings(settings, localStorage);
restart();
