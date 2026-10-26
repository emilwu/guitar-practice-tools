import { playNotes } from "../shared/audio.js";
import { mountToneSelect } from "../shared/tone.js";
import { chordDiagramSvg, neckSvg } from "../shared/diagram.js";
import "../shared/pwa.js";
import { parseChord } from "../shared/theory.js";
import { explainChord } from "./explain.js";
import { analyzeScale, buildMarkers, scaleChoices } from "./scales.js";
import { loadState, saveState, serializeHash } from "./state.js";
import { triadLesson } from "./triads.js";
import { bestNextVoicing, triadShapes, voicingsFor } from "./voicings.js";
import { commonToneNames, guideToneLines, progressionFor, voiceLeadProgression } from "./voiceleading.js";

const state = loadState(location.hash, localStorage);
const chordInput = document.querySelector("#chord-input");
const errorEl = document.querySelector("#chord-error");
chordInput.value = state.chord;
mountToneSelect(document.querySelector("#tone-slot"));

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function selectedVoicing(chord) {
  const list = voicingsFor(chord);
  return list.find((voicing) => voicing.id === state.voicing) || list[0] || null;
}

function persist() {
  saveState(state, localStorage);
  const hash = serializeHash(state);
  if (location.hash.replace(/^#/, "") !== hash) history.replaceState(null, "", `#${hash}`);
}

function render() {
  const chord = parseChord(state.chord);
  if (chord.empty) return;
  const list = voicingsFor(chord);
  const selected = list.find((voicing) => voicing.id === state.voicing) || list[0] || null;
  if (selected && state.voicing !== selected.id) state.voicing = selected.id;
  const choices = scaleChoices(chord);
  if (state.scale && !choices.some((choice) => choice.id === state.scale)) state.scale = "";
  const choice = choices.find((item) => item.id === state.scale) || null;
  const analysis = choice ? analyzeScale(chord, choice) : null;
  const neck = buildMarkers(chord, analysis, analysis?.pentatonic ? state.box : 0);

  document.querySelector("#sec-quality").innerHTML = qualityHtml(chord);
  document.querySelector("#sec-tones").innerHTML = tonesHtml(chord);
  document.querySelector("#sec-voicings").innerHTML = voicingsHtml(list, selected);
  document.querySelector("#sec-neck").innerHTML = neckHtml(chord, analysis, neck);
  document.querySelector("#sec-triads").innerHTML = triadsHtml(chord, selected);
  document.querySelector("#sec-scales").innerHTML = scalesHtml(chord, choices, analysis);
  const transition = nextHtml(chord, selected);
  document.querySelector("#sec-presets").innerHTML = transition.presets;
  document.querySelector("#sec-transition").innerHTML = transition.body;
  const nextField = document.querySelector("#next-input");
  if (nextField && document.activeElement !== nextField) nextField.value = state.next;
  persist();
}

function qualityHtml(chord) {
  const copy = explainChord(chord);
  return `<p class="symbol">${esc(chord.symbol)}</p><h2 class="quality-title">${esc(copy.title)}</h2><p>${esc(copy.body)}</p>`;
}

function tonesHtml(chord) {
  const tones = chord.tones
    .map((tone) => `<div class="tone"><b>${esc(tone.display)}</b><span>${esc(tone.label)}</span></div>`)
    .join("");
  return `<h2>組成音</h2><p class="muted">公式 ${esc(chord.formula)}</p><div class="tone-grid">${tones}</div>`;
}

function voicingsHtml(list, selected) {
  if (!list.length) return `<h2>按法</h2><p>這個和弦在 4 格以內沒有夠用的按法。</p>`;
  const cards = list
    .map((voicing) => {
      const on = voicing.id === selected?.id;
      return `<button type="button" class="voicing-card${on ? " is-on" : ""}" data-voicing="${esc(voicing.id)}" aria-pressed="${on ? "true" : "false"}">
        <small>${esc(voicing.label)}</small>
        ${chordDiagramSvg(voicing, { selected: on })}
      </button>`;
    })
    .join("");
  return `<h2>按法</h2><p class="hint">最多 6 個，跨度不超過 4 格。點一下聽撥弦。含常用按法、E 型／A 型封閉、shell voicing、上四弦 Drop 2。</p><div class="voicing-scroller">${cards}</div>`;
}

function neckHtml(chord, analysis, neck) {
  const boxNote = neck.box
    ? `<p>五聲第 ${neck.box.box} 框從第 6 弦第 ${neck.box.rootOnString6} 格的根音開始。淡色的點是同一音階、但不在這個框裡。</p>`
    : "";
  const avoid = analysis
    ? analysis.avoids.length
      ? `避免音：${analysis.avoids.map((tone) => `${tone.display}（${tone.label}）`).join("、")}。`
      : analysis.noAvoid
        ? "這個音階沒有避免音；藍調音與色彩音可以碰，句子仍落在和弦音。"
        : "這個音階沒有半音卡在和弦音上面的避免音。"
    : "還沒選音階，指板上是這個和弦的音。";
  const landing = analysis ? `落點音：${analysis.landing.map((tone) => `${tone.display}（${tone.label}）`).join("、")}。` : "";
  return `<h2>指板</h2><p class="hint">${esc(landing)} ${esc(avoid)}</p>${boxNote}
    <div class="neck-scroll">${neckSvg(neck)}</div>
    <div class="legend">
      <span><i class="swatch swatch-root"></i>R 根音</span>
      <span><i class="swatch swatch-third"></i>3／b3／4</span>
      <span><i class="swatch swatch-fifth"></i>5／b5／#5</span>
      <span><i class="swatch swatch-seventh"></i>7／b7</span>
      <span><i class="swatch swatch-ext"></i>延伸音</span>
      <span><i class="swatch swatch-scale"></i>音階音</span>
      <span><i class="swatch swatch-avoid"></i>避免音</span>
    </div>`;
}

function triadsHtml(chord, selected) {
  const shapes = triadShapes(chord, selected);
  if (!shapes.length) return `<h2>三和弦／琶音</h2><p>這個和弦沒有完整的三音骨架。</p>`;
  const lesson = triadLesson(chord);
  const qualities = lesson.qualities
    .map((item) => `<li>${esc(item.name)}：${esc(item.formula)}</li>`)
    .join("");
  const inversions = lesson.inversions
    .map((item) => `<li>${esc(item.name)}：最低音是 ${esc(item.bass)}，低到高 ${esc(item.order)}</li>`)
    .join("");
  const upper = lesson.upperText ? `<p>${esc(lesson.upperText)}</p>` : "";
  const cards = shapes
    .map((shape, index) => {
      const near = shape.nearest ? `<em class="near-tag">最靠近</em>` : "";
      return `<button type="button" class="triad-card${shape.nearest ? " is-near" : ""}" data-triad="${index}">
        <span class="triad-kicker">${esc(shape.stringPlain)}</span>
        <strong>${esc(shape.inversionLabel)}</strong>
        <span class="triad-order">${esc(shape.orderLabel)}</span>
        <span class="triad-meta">${esc(shape.fretRange)} · ${esc(shape.degreeLabel)} ${near}</span>
        ${chordDiagramSvg(shape, { selected: shape.nearest, annotate: true })}
      </button>`;
    })
    .join("");
  return `<h2>三和弦／琶音</h2>
    <details class="triad-help">
      <summary>這是什麼？</summary>
      <div class="triad-help-body">
        <p>三和弦是三個音：根音 R、三度（3 或 b3）、五度（5、b5 或 #5）。</p>
        <ul>${qualities}</ul>
        <p>${esc(lesson.relation)}</p>
        ${upper}
        <p>轉位就是換哪一個音放在最低。</p>
        <ul>${inversions}</ul>
        <p>第 1–3 弦是高音三條，伴奏和旋律都好用；第 2–4 弦再低一點，也很好按。更低的弦組以後再加。</p>
      </div>
    </details>
    <p class="hint">「最靠近」是離上面你選的那個按法最近的三音，手不用挪很遠。點一下可以聽這三個音。</p>
    <p class="hint">練法：同一組弦上，把三個轉位沿著琴頸連起來，再對著這個和弦把這三個音拆開彈。</p>
    <div class="triad-grid">${cards}</div>`;
}

function scalesHtml(chord, choices, analysis) {
  const buttons = choices
    .map((choice) => {
      const on = choice.id === state.scale;
      return `<button type="button" class="chip" data-scale="${esc(choice.id)}" aria-pressed="${on ? "true" : "false"}">${esc(choice.en)}</button>`;
    })
    .join("");
  const clear = `<button type="button" class="chip" data-scale="" aria-pressed="${state.scale ? "false" : "true"}">只看和弦音</button>`;
  let boxes = "";
  if (analysis?.pentatonic) {
    boxes = `<div class="row" style="margin-top:8px">${[1, 2, 3, 4, 5]
      .map((n) => `<button type="button" class="chip" data-box="${n}" aria-pressed="${Number(state.box) === n ? "true" : "false"}">第 ${n} 框</button>`)
      .join("")}</div>`;
  }
  const blurb = analysis ? `<p>${esc(analysis.blurb)}</p>` : `<p class="hint">maj 用 major pentatonic、Ionian、Lydian；m 用 minor pentatonic、Dorian、Aeolian；7 用 Mixolydian、Blues；m7b5 用 Locrian。</p>`;
  return `<h2>音階</h2><div class="row">${clear}${buttons}</div>${blurb}${boxes}`;
}

function guideHtml(lines) {
  if (!lines.length) return `<p class="hint">這個進行沒有 3 音或 7 音可以連成 guide tone。</p>`;
  const rows = lines
    .map((line) => {
      const bits = line
        .map((note) => `<span class="gnote">${esc(note.name)} <small>${esc(note.label)}</small></span>`)
        .join('<span class="arrow">→</span>');
      return `<div class="guide-line">${bits}</div>`;
    })
    .join("");
  return `<h3>guide tone</h3><p class="hint">3 音和 7 音走到下一個和弦最近的 3 或 7。共同音留在原地。</p><div class="guide">${rows}</div>`;
}

function stepCards(path) {
  return `<div class="steps">${path
    .map((step) => {
      if (!step.voicing) return `<div class="step-card"><small>${esc(step.chord.symbol)} 沒有按法</small></div>`;
      const move = step.movement ? `<small>移動 ${step.movement} 個半音</small>` : "";
      return `<button type="button" class="step-card" data-load="${esc(step.chord.symbol)}">
        <small>${esc(step.chord.symbol)} · ${esc(step.voicing.label)}</small>
        ${chordDiagramSvg(step.voicing)}
        ${move}
      </button>`;
    })
    .join("")}</div>`;
}

function nextHtml(chord, selected) {
  const tonic = chord.root;
  const one = progressionFor(tonic, "cadence");
  const two = progressionFor(tonic, "251");
  const four = progressionFor(tonic, "iv");
  const presets = `<div class="row">
      <button type="button" class="chip" data-prog="cadence" aria-pressed="${state.prog === "cadence" ? "true" : "false"}">把 ${esc(tonic)} 當 V7 → ${esc(one[1] || "")}</button>
      <button type="button" class="chip" data-prog="251" aria-pressed="${state.prog === "251" ? "true" : "false"}">以 ${esc(tonic)} 為 I 的 ii–V–I</button>
      <button type="button" class="chip" data-prog="iv" aria-pressed="${state.prog === "iv" ? "true" : "false"}">${esc(tonic)} 調 IV → iv</button>
      <button type="button" class="chip" data-example="c251">看 C 調 ii–V–I</button>
    </div>`;
  let body = `<p class="hint">輸入下一個和弦，或用功能挑一個常見的下一步。ii–V–I 以目前根音當 I。</p>`;
  if (state.prog === "251") {
    const symbols = two;
    const path = voiceLeadProgression(symbols);
    const lines = guideToneLines(symbols);
    body = `<p>I 是 ${esc(tonic)}。進行 ${symbols.map(esc).join(" → ")}。按法是總半音移動最少的一條。</p>${stepCards(path)}${guideHtml(lines)}`;
  } else if (state.next) {
    const next = parseChord(state.next);
    if (next.empty) body = `<p class="error">下一個和弦認不得。</p>`;
    else {
      const best = selected ? bestNextVoicing(selected, next) : voicingsFor(next)[0];
      const lines = guideToneLines([chord, next]);
      const common = commonToneNames(chord, next);
      const commonText = common.length
        ? `共同音：${common.map((tone) => `${tone.note}（${tone.labelA} → ${tone.labelB}）`).join("、")}。`
        : "沒有共同音。";
      const move = best?.movement != null ? `總共移動 ${best.movement} 個半音。` : "";
      const cards = stepCards([
        { chord, voicing: selected, movement: 0 },
        { chord: next, voicing: best, movement: best?.movement || 0 },
      ]);
      body = `<p>${esc(commonText)} ${esc(move)}</p>${cards}${guideHtml(lines)}`;
    }
  } else if (state.prog === "iv") {
    body = `<p>${esc(four.join(" → "))}。三度音往下半音，根音留著。</p>${guideHtml(guideToneLines(four))}`;
  }
  return { presets, body };
}

function setChord(symbol, extra = {}) {
  const parsed = parseChord(symbol);
  if (parsed.empty) return;
  state.chord = parsed.symbol;
  state.voicing = extra.voicing || "";
  if ("next" in extra) state.next = extra.next;
  if ("prog" in extra) state.prog = extra.prog;
  if ("scale" in extra) state.scale = extra.scale;
  chordInput.value = state.chord;
  errorEl.hidden = true;
  render();
}

let chordTimer = 0;
chordInput.addEventListener("input", () => {
  window.clearTimeout(chordTimer);
  chordTimer = window.setTimeout(() => {
    const parsed = parseChord(chordInput.value);
    if (parsed.empty) {
      errorEl.hidden = false;
      errorEl.textContent = "認不得這個和弦。試試 C、Am7、Dm7b5、E7#9、Cmaj9、Csus4、Cdim7。";
      return;
    }
    errorEl.hidden = true;
    state.chord = parsed.symbol;
    state.voicing = "";
    if (state.prog && state.prog !== "251") state.prog = "";
    render();
  }, 160);
});

document.querySelector("#chord-form").addEventListener("submit", (event) => {
  event.preventDefault();
  chordInput.blur();
});

document.body.addEventListener("input", (event) => {
  if (event.target.id !== "next-input") return;
  state.next = event.target.value.trim();
  if (state.prog === "251") state.prog = "";
  render();
});

document.body.addEventListener("submit", (event) => {
  if (event.target.id === "next-form") event.preventDefault();
});

document.body.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const chord = parseChord(state.chord);
  if (button.dataset.voicing) {
    state.voicing = button.dataset.voicing;
    const voicing = voicingsFor(chord).find((item) => item.id === state.voicing);
    if (voicing) playNotes(voicing.notes);
    render();
    return;
  }
  if (button.dataset.triad != null) {
    const shape = triadShapes(chord, selectedVoicing(chord))[Number(button.dataset.triad)];
    if (shape) playNotes(shape.notes);
    return;
  }
  if (button.dataset.scale != null) {
    state.scale = button.dataset.scale;
    if (state.scale) state.box = 1;
    render();
    return;
  }
  if (button.dataset.box) {
    state.box = Number(button.dataset.box);
    render();
    return;
  }
  if (button.dataset.example === "c251") {
    setChord("Cmaj7", { prog: "251", next: "", voicing: "" });
    return;
  }
  if (button.dataset.prog === "251") {
    state.prog = state.prog === "251" ? "" : "251";
    state.next = "";
    render();
    return;
  }
  if (button.dataset.prog === "cadence") {
    const symbols = progressionFor(chord.root, "cadence");
    setChord(symbols[0], { next: symbols[1], prog: "cadence", voicing: "" });
    return;
  }
  if (button.dataset.prog === "iv") {
    const symbols = progressionFor(chord.root, "iv");
    setChord(symbols[0], { next: symbols[1], prog: "iv", voicing: "" });
    return;
  }
  if (button.dataset.load) {
    const symbols = state.prog === "251" ? progressionFor(chord.root, "251") : [state.chord, state.next].filter(Boolean);
    const path = voiceLeadProgression(symbols, state.prog === "251" ? null : selectedVoicing(chord));
    const step = path.find((item) => item.chord.symbol === button.dataset.load);
    if (step?.voicing) playNotes(step.voicing.notes);
    const index = path.findIndex((item) => item.chord.symbol === button.dataset.load);
    const following = path[index + 1]?.chord.symbol || "";
    setChord(button.dataset.load, { next: following, prog: "", voicing: step?.voicing?.id || "" });
  }
});

window.addEventListener("hashchange", () => {
  const next = loadState(location.hash, null);
  if (location.hash.replace(/^#/, "")) {
    Object.assign(state, next);
    chordInput.value = state.chord;
    render();
  }
});

render();
