import "../shared/pwa.js";
import {
  BPM_MAX,
  BPM_MIN,
  DEFAULT_STATE,
  METERS,
  SUBDIVISIONS,
  TRIPLET_SWING_PERCENT,
  advancePosition,
  barAudible,
  cycleAccent,
  defaultAccents,
  gapStatus,
  jazzAccents,
  ladderAtBar,
  loadState,
  meterSpec,
  normalizePosition,
  normalizeState,
  resolveBpm,
  saveState,
  serializeHash,
  soundAt,
  stepDuration,
  subdivisionHint,
  subdivisionSpec,
  swingHint,
  averageTapTempo,
} from "./timing.js";

const state = loadState(location.hash, localStorage);
let running = false;
let viewBar = 0;
let nextTime = 0;
let pos = { bar: 0, beat: 0, sub: 0 };
let cues = [];
let pumpTimer = 0;
let inPump = false;
let refill = false;
let raf = 0;
let frameGen = 0;
let audioCtx = null;
const taps = [];
const active = [];
const clickBuffers = {};

const stand = document.querySelector("#stand");
const kicker = document.querySelector("#stand-kicker");
const beatNum = document.querySelector("#beat-num");
const pips = document.querySelector("#sub-pips");
const liveBpm = document.querySelector("#live-bpm");
const standMeta = document.querySelector("#stand-meta");
const transportStatus = document.querySelector("#transport-status");
const startButton = document.querySelector("#start");
const tapButton = document.querySelector("#tap");
const bpmNumber = document.querySelector("#bpm-num");
const bpmRange = document.querySelector("#bpm-range");
const meterBox = document.querySelector("#meters");
const meterHint = document.querySelector("#meter-hint");
const subBox = document.querySelector("#subs");
const subHint = document.querySelector("#sub-hint");
const swing = document.querySelector("#swing");
const swingReadout = document.querySelector("#swing-readout");
const swingHintEl = document.querySelector("#swing-hint");
const beatDots = document.querySelector("#beat-dots");
const jazzButton = document.querySelector("#jazz");
const playBars = document.querySelector("#play-bars");
const muteBars = document.querySelector("#mute-bars");
const gapPresets = document.querySelector("#gap-presets");
const ladderOn = document.querySelector("#ladder-on");
const ladderStart = document.querySelector("#lstart");
const ladderTarget = document.querySelector("#ltarget");
const ladderStep = document.querySelector("#lstep");
const ladderBars = document.querySelector("#lbars");
const ladderProgress = document.querySelector("#ladder-progress");
const volume = document.querySelector("#volume");
const volumeReadout = document.querySelector("#vol-readout");
const flash = document.querySelector("#flash");
const copyStatus = document.querySelector("#copy-status");

const GAP_PRESETS = [
  { play: 2, mute: 0, label: "關閉" },
  { play: 1, mute: 1, label: "1 開 1 關" },
  { play: 2, mute: 2, label: "2 開 2 關" },
  { play: 4, mute: 4, label: "4 開 4 關" },
];

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function sameAccents(left, right) {
  return left.length === right.length && left.every((level, index) => level === right[index]);
}

function getContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function renderTone(ctx, { seconds, partials, noiseDecay }) {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  let peak = 0;
  for (let index = 0; index < length; index += 1) {
    const time = index / sampleRate;
    let sample = 0;
    for (const partial of partials) {
      sample += Math.sin(2 * Math.PI * partial.freq * time) * Math.exp(-time * partial.decay) * partial.gain;
    }
    if (noiseDecay) sample += (Math.random() * 2 - 1) * Math.exp(-time * noiseDecay) * 0.35;
    data[index] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const norm = peak > 0 ? 0.98 / peak : 1;
  for (let index = 0; index < length; index += 1) data[index] *= norm;
  return buffer;
}

function ensureClicks(ctx) {
  if (clickBuffers.accent && clickBuffers.rate === ctx.sampleRate) return;
  clickBuffers.rate = ctx.sampleRate;
  clickBuffers.accent = renderTone(ctx, {
    seconds: 0.072,
    partials: [
      { freq: 466, decay: 36, gain: 0.9 },
      { freq: 1390, decay: 70, gain: 0.48 },
    ],
    noiseDecay: 200,
  });
  clickBuffers.normal = renderTone(ctx, {
    seconds: 0.046,
    partials: [{ freq: 988, decay: 58, gain: 1 }],
    noiseDecay: 120,
  });
  clickBuffers.subdivision = renderTone(ctx, {
    seconds: 0.02,
    partials: [{ freq: 1760, decay: 140, gain: 1 }],
    noiseDecay: 0,
  });
}

const LOUDNESS = { accent: 0.92, normal: 0.52, subdivision: 0.24 };

function playClick(ctx, time, kind, level) {
  const buffer = clickBuffers[kind];
  if (!buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(LOUDNESS[kind] * (level / 100), time);
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(time);
  source.stop(time + buffer.duration + 0.01);
  active.push(source);
  source.onended = () => {
    const index = active.indexOf(source);
    if (index >= 0) active.splice(index, 1);
  };
}

function silenceQueued() {
  const now = audioCtx ? audioCtx.currentTime : 0;
  for (const source of active) {
    try {
      source.stop(now);
    } catch {
      /* already stopped */
    }
  }
  active.length = 0;
}

function persist() {
  saveState(state, localStorage);
  const hash = serializeHash(state);
  if (location.hash.replace(/^#/, "") !== hash) history.replaceState(null, "", `#${hash}`);
}

function apply(patch) {
  Object.assign(state, normalizeState({ ...state, ...patch }));
  persist();
  syncControls();
  paintReadout(latestCue(heardNow()));
}

function setNumber(input, value) {
  if (document.activeElement === input) return;
  input.value = String(value);
}

function displayedBpm() {
  if (state.ladderOn) return resolveBpm(viewBar, state);
  return state.bpm;
}

function metaText() {
  const sub = subdivisionSpec(state.subdivision);
  const swingText = state.subdivision === "eighth" ? ` · Swing ${state.swing}%` : "";
  return `${state.meter} · ${sub.label}${swingText}`;
}

function ladderText(bar) {
  if (!state.ladderOn) return "階梯關著。播放時用上面的 BPM。";
  const info = ladderAtBar(bar, state);
  const span = `${info.bpms[0]} → ${info.bpms[info.bpms.length - 1]}`;
  if (info.finished) return `已到目標 ${info.bpm} BPM，會維持這個速度。`;
  if (!running) {
    return `將從 ${span}，每段 ${state.ladderStep} BPM、${info.bars} 小節。共 ${info.count} 段。`;
  }
  return `第 ${info.index + 1} / ${info.count} 段 · ${info.bpm} BPM · 本段第 ${info.barInStep + 1} / ${info.bars} 小節`;
}

function syncControls() {
  setNumber(bpmNumber, state.bpm);
  bpmRange.value = String(state.bpm);
  meterBox.querySelectorAll("[data-meter]").forEach((button) => {
    const on = button.dataset.meter === state.meter;
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.classList.toggle("is-on", on);
  });
  meterHint.textContent = meterSpec(state.meter).hint;
  subBox.querySelectorAll("[data-sub]").forEach((button) => {
    const on = button.dataset.sub === state.subdivision;
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.classList.toggle("is-on", on);
  });
  subHint.textContent = subdivisionHint(state.meter);
  swing.value = String(state.swing);
  swingReadout.textContent = `${state.swing}%`;
  swingHintEl.textContent = swingHint(state.subdivision);
  document.querySelector("#swing-straight").classList.toggle("is-on", state.swing === 50);
  document.querySelector("#swing-triplet").classList.toggle("is-on", state.swing === TRIPLET_SWING_PERCENT);
  document.querySelector("#swing-heavy").classList.toggle("is-on", state.swing === 75);
  const jazz = jazzAccents(state.meter);
  jazzButton.classList.toggle("is-on", sameAccents(state.accents, jazz));
  jazzButton.setAttribute("aria-pressed", sameAccents(state.accents, jazz) ? "true" : "false");
  beatDots.innerHTML = state.accents
    .map((level, index) => {
      const name = level === "accent" ? "重音" : level === "mute" ? "靜音" : "普通";
      return `<button type="button" class="beat-dot is-${level}" data-beat="${index}" aria-label="第 ${index + 1} 拍，${name}">${index + 1}</button>`;
    })
    .join("");
  setNumber(playBars, state.playBars);
  setNumber(muteBars, state.muteBars);
  gapPresets.querySelectorAll("[data-gap]").forEach((button) => {
    const on = Number(button.dataset.play) === state.playBars && Number(button.dataset.mute) === state.muteBars;
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  });
  ladderOn.checked = state.ladderOn;
  setNumber(ladderStart, state.ladderStart);
  setNumber(ladderTarget, state.ladderTarget);
  setNumber(ladderStep, state.ladderStep);
  setNumber(ladderBars, state.ladderBars);
  volume.value = String(state.volume);
  volumeReadout.textContent = `${state.volume}%`;
  flash.checked = state.flash;
  standMeta.textContent = metaText();
  if (!running) ladderProgress.textContent = ladderText(0);
}

function heardNow() {
  if (!audioCtx) return 0;
  const extra = Number.isFinite(audioCtx.outputLatency) ? audioCtx.outputLatency : 0;
  return audioCtx.currentTime - Math.min(Math.max(extra, 0), 0.1);
}

function latestCue(now) {
  let current = null;
  for (const cue of cues) {
    if (cue.time <= now) current = cue;
    else break;
  }
  return current;
}

function syncLogLink(bpm) {
  const logLink = document.querySelector("#log-practice");
  if (!logLink) return;
  const params = new URLSearchParams();
  params.set("tool", "metronome");
  params.set("bpm", String(bpm));
  const from = new URLSearchParams(location.search).get("from");
  logLink.href = `../log/${from ? `?from=${encodeURIComponent(from)}` : ""}#${params.toString()}`;
}

function paintReadout(cue) {
  const bpm = cue?.bpm ?? displayedBpm();
  liveBpm.textContent = String(bpm);
  syncLogLink(bpm);
  standMeta.textContent = metaText();
  if (!running) {
    kicker.textContent = "準備";
    beatNum.textContent = "1";
    beatNum.className = "beat-num";
    stand.classList.remove("is-flash", "is-accent", "is-normal");
    paintPips(0, false);
    markBeat(-1);
    ladderProgress.textContent = ladderText(0);
    return;
  }
  if (!cue) {
    kicker.textContent = "播放中";
    return;
  }
  viewBar = cue.bar;
  const gap = gapStatus(cue.bar, state.playBars, state.muteBars);
  if (!gap.audible) {
    kicker.textContent = `靜音小節 · ${gap.label}`;
    beatNum.textContent = "靜";
    beatNum.className = "beat-num is-gap";
    stand.classList.remove("is-flash", "is-accent", "is-normal");
    paintPips(cue.sub, true);
    markBeat(-1);
  } else {
    kicker.textContent = state.muteBars > 0 ? `播放中 · ${gap.label}` : `播放中 · 第 ${cue.bar + 1} 小節`;
    const level = state.accents[cue.beat] || "normal";
    beatNum.textContent = String(cue.beat + 1);
    beatNum.className = `beat-num ${level === "accent" ? "is-accent" : level === "mute" ? "is-quiet" : "is-normal"}`;
    const onBeat = cue.sub === 0 && heardNow() - cue.time < 0.09 && level !== "mute";
    const flashOn = state.flash && onBeat;
    stand.classList.toggle("is-flash", flashOn);
    stand.classList.toggle("is-accent", flashOn && level === "accent");
    stand.classList.toggle("is-normal", flashOn && level !== "accent");
    paintPips(cue.sub, false);
    markBeat(cue.beat);
  }
  ladderProgress.textContent = ladderText(cue.bar);
}

function paintPips(sub, hidden) {
  const parts = subdivisionSpec(state.subdivision).parts;
  if (pips.childElementCount !== parts) {
    pips.innerHTML = Array.from({ length: parts }, () => `<span class="pip"></span>`).join("");
  }
  pips.hidden = hidden;
  [...pips.children].forEach((pip, index) => pip.classList.toggle("is-on", !hidden && index === sub));
}

function markBeat(beat) {
  [...beatDots.children].forEach((dot, index) => dot.classList.toggle("is-current", index === beat));
}

function frame(gen) {
  if (!running || gen !== frameGen) return;
  paintReadout(latestCue(heardNow()));
  raf = requestAnimationFrame(() => frame(gen));
}

function kickFrame() {
  frameGen += 1;
  const gen = frameGen;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => frame(gen));
}

/**
 * Lookahead scheduler. setTimeout only wakes the planner.
 * Click times are absolute AudioContext times. The timer only refills the queue.
 * A hidden tab schedules a longer window so a throttled timer still stays ahead.
 * If the page was frozen, missed clicks are skipped instead of dumped at once.
 */
function pump() {
  if (!running) return;
  if (inPump) {
    refill = true;
    return;
  }
  inPump = true;
  refill = false;
  clearTimeout(pumpTimer);
  try {
    const ctx = getContext();
    ensureClicks(ctx);
    if (nextTime < ctx.currentTime - 0.05) {
      let skipped = 0;
      while (nextTime < ctx.currentTime + 0.02 && skipped < 4000) {
        pos = normalizePosition(pos, state.meter, state.subdivision);
        const bpm = resolveBpm(pos.bar, state);
        nextTime += stepDuration(60 / bpm, state.subdivision, state.swing, pos.sub);
        pos = advancePosition(pos, state.meter, state.subdivision);
        skipped += 1;
      }
      if (nextTime < ctx.currentTime + 0.02) nextTime = ctx.currentTime + 0.02;
    }
    const horizon = ctx.currentTime + (document.hidden ? 2.5 : 0.15);
    let guard = 0;
    while (nextTime < horizon && guard < 500) {
      guard += 1;
      pos = normalizePosition(pos, state.meter, state.subdivision);
      const bpm = resolveBpm(pos.bar, state);
      const sound = soundAt(pos, state);
      if (sound && state.volume > 0) playClick(ctx, nextTime, sound, state.volume);
      cues.push({
        time: nextTime,
        bar: pos.bar,
        beat: pos.beat,
        sub: pos.sub,
        sound,
        bpm,
        audible: barAudible(pos.bar, state.playBars, state.muteBars),
      });
      nextTime += stepDuration(60 / bpm, state.subdivision, state.swing, pos.sub);
      pos = advancePosition(pos, state.meter, state.subdivision);
    }
    const stale = ctx.currentTime - 1;
    while (cues.length > 1 && cues[0].time < stale) cues.shift();
  } finally {
    inPump = false;
  }
  if (!running) return;
  if (refill) {
    pump();
    return;
  }
  pumpTimer = setTimeout(pump, document.hidden ? 250 : 25);
}

function start() {
  const ctx = getContext();
  ensureClicks(ctx);
  running = true;
  viewBar = 0;
  pos = { bar: 0, beat: 0, sub: 0 };
  cues = [];
  nextTime = ctx.currentTime + 0.06;
  startButton.textContent = "停止";
  startButton.classList.add("is-on");
  startButton.setAttribute("aria-pressed", "true");
  transportStatus.textContent = "播放中";
  pump();
  kickFrame();
}

function stop() {
  running = false;
  frameGen += 1;
  clearTimeout(pumpTimer);
  cancelAnimationFrame(raf);
  silenceQueued();
  cues = [];
  viewBar = 0;
  startButton.textContent = "開始";
  startButton.classList.remove("is-on");
  startButton.setAttribute("aria-pressed", "false");
  transportStatus.textContent = "已停止";
  paintReadout(null);
}

function toggle() {
  if (running) stop();
  else start();
}

function bump(delta) {
  getContext();
  if (state.ladderOn) {
    const nextStart = Math.min(BPM_MAX, Math.max(BPM_MIN, state.ladderStart + delta));
    const applied = nextStart - state.ladderStart;
    apply({ ladderStart: nextStart, ladderTarget: state.ladderTarget + applied });
    return;
  }
  apply({ bpm: state.bpm + delta });
}

function onBpmTyping(event) {
  const raw = event.target.value;
  if (raw === "" || !Number.isFinite(Number(raw))) return;
  const number = Math.round(Number(raw));
  if (number < BPM_MIN || number > BPM_MAX) return;
  state.bpm = number;
  if (event.target !== bpmRange) bpmRange.value = String(number);
  if (event.target !== bpmNumber) bpmNumber.value = String(number);
  persist();
  paintReadout(latestCue(heardNow()));
}

function commitBpm(event) {
  apply({ bpm: event.target.value || DEFAULT_STATE.bpm });
}

function commitCount(event, key, min) {
  const raw = event.target.value;
  if (raw === "" || !Number.isFinite(Number(raw))) return;
  const number = Math.round(Number(raw));
  const max = Number(event.target.max);
  if (number < min || number > max) return;
  apply({ [key]: number });
}

meterBox.innerHTML = METERS.map(
  (meter) =>
    `<button type="button" class="chip" data-meter="${esc(meter.id)}" aria-pressed="false">${esc(meter.label)}</button>`,
).join("");
subBox.innerHTML = SUBDIVISIONS.map(
  (item) => `<button type="button" class="chip" data-sub="${esc(item.id)}" aria-pressed="false">${esc(item.label)}</button>`,
).join("");
gapPresets.innerHTML = GAP_PRESETS.map(
  (preset) =>
    `<button type="button" class="chip" data-gap="1" data-play="${preset.play}" data-mute="${preset.mute}">${esc(preset.label)}</button>`,
).join("");

startButton.addEventListener("click", () => {
  getContext();
  toggle();
});
tapButton.addEventListener("click", () => {
  getContext();
  const now = performance.now();
  taps.push(now);
  if (taps.length > 8) taps.splice(0, taps.length - 8);
  const bpm = averageTapTempo(taps);
  if (bpm == null) return;
  apply({ bpm, ladderOn: false });
});
document.querySelectorAll("[data-bump]").forEach((button) => {
  button.addEventListener("click", () => bump(Number(button.dataset.bump)));
});
bpmNumber.addEventListener("input", onBpmTyping);
bpmRange.addEventListener("input", onBpmTyping);
bpmNumber.addEventListener("change", commitBpm);
meterBox.addEventListener("click", (event) => {
  const button = event.target.closest("[data-meter]");
  if (!button) return;
  const meter = button.dataset.meter;
  const accents = state.accents.length === meterSpec(meter).beats ? state.accents : defaultAccents(meter);
  apply({ meter, accents: meter === state.meter ? state.accents : accents });
});
subBox.addEventListener("click", (event) => {
  const button = event.target.closest("[data-sub]");
  if (!button) return;
  apply({ subdivision: button.dataset.sub });
});
swing.addEventListener("input", () => apply({ swing: swing.value }));
document.querySelector("#swing-straight").addEventListener("click", () => apply({ swing: 50 }));
document.querySelector("#swing-triplet").addEventListener("click", () => apply({ swing: TRIPLET_SWING_PERCENT }));
document.querySelector("#swing-heavy").addEventListener("click", () => apply({ swing: 75 }));
beatDots.addEventListener("click", (event) => {
  const button = event.target.closest("[data-beat]");
  if (!button) return;
  const accents = state.accents.slice();
  const index = Number(button.dataset.beat);
  accents[index] = cycleAccent(accents[index]);
  apply({ accents });
});
jazzButton.addEventListener("click", () => apply({ accents: jazzAccents(state.meter) }));
document.querySelector("#accent-reset").addEventListener("click", () => apply({ accents: defaultAccents(state.meter) }));
playBars.addEventListener("input", (event) => commitCount(event, "playBars", 1));
muteBars.addEventListener("input", (event) => commitCount(event, "muteBars", 0));
playBars.addEventListener("change", (event) => apply({ playBars: event.target.value }));
muteBars.addEventListener("change", (event) => apply({ muteBars: event.target.value }));
gapPresets.addEventListener("click", (event) => {
  const button = event.target.closest("[data-gap]");
  if (!button) return;
  apply({ playBars: Number(button.dataset.play), muteBars: Number(button.dataset.mute) });
});
ladderOn.addEventListener("change", () => apply({ ladderOn: ladderOn.checked }));
ladderStart.addEventListener("input", (event) => commitCount(event, "ladderStart", BPM_MIN));
ladderTarget.addEventListener("input", (event) => commitCount(event, "ladderTarget", BPM_MIN));
ladderStep.addEventListener("input", (event) => commitCount(event, "ladderStep", 1));
ladderBars.addEventListener("input", (event) => commitCount(event, "ladderBars", 1));
for (const input of [ladderStart, ladderTarget, ladderStep, ladderBars]) {
  input.addEventListener("change", () => {
    apply({
      ladderStart: ladderStart.value,
      ladderTarget: ladderTarget.value,
      ladderStep: ladderStep.value,
      ladderBars: ladderBars.value,
    });
  });
}
volume.addEventListener("input", () => apply({ volume: volume.value }));
flash.addEventListener("change", () => apply({ flash: flash.checked }));
document.querySelector("#copy-link").addEventListener("click", async () => {
  persist();
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    copyStatus.textContent = "已複製連結。";
  } catch {
    copyStatus.textContent = url;
  }
});

document.addEventListener("keydown", (event) => {
  const field = event.target.closest?.("input, textarea, select");
  if (event.code === "Space") {
    if (field && event.target.type !== "range") return;
    if (event.target.closest?.("button, a, input, textarea, select")) return;
    event.preventDefault();
    getContext();
    toggle();
    return;
  }
  if (field) return;
  if (event.code === "ArrowUp") {
    event.preventDefault();
    bump(1);
  } else if (event.code === "ArrowDown") {
    event.preventDefault();
    bump(-1);
  } else if (event.code === "ArrowRight") {
    event.preventDefault();
    bump(5);
  } else if (event.code === "ArrowLeft") {
    event.preventDefault();
    bump(-5);
  }
});

document.addEventListener("visibilitychange", () => {
  if (!running) return;
  if (!document.hidden) kickFrame();
  pump();
});
document.addEventListener("resume", () => {
  if (!running) return;
  if (audioCtx?.state === "suspended") audioCtx.resume();
  pump();
});

window.addEventListener("hashchange", () => {
  Object.assign(state, loadState(location.hash, localStorage));
  syncControls();
  paintReadout(latestCue(heardNow()));
});

syncControls();
persist();
paintReadout(null);
