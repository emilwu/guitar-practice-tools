import { GUITARS, SYNTH_ID, readTone, writeTone } from "./samples/index.js";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

/** Shared guitar-tone control. The choice is stored for every tool. */
export function mountToneSelect(root, storage = globalThis.localStorage) {
  if (!root) return { getTone: () => readTone(storage) };

  function paint() {
    const current = readTone(storage);
    const options = [...GUITARS.map((guitar) => ({ id: guitar.id, label: guitar.name })), { id: SYNTH_ID, label: "合成" }];
    root.innerHTML = `<div class="tone-select" role="group" aria-label="吉他音色">
      <span class="tone-label">吉他音色</span>
      <div class="tone-options">${options
        .map(
          (option) =>
            `<button type="button" class="tone-option${option.id === current ? " is-on" : ""}" data-tone="${esc(option.id)}" aria-pressed="${option.id === current ? "true" : "false"}">${esc(option.label)}</button>`,
        )
        .join("")}</div>
    </div>`;
  }

  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tone]");
    if (!button || !root.contains(button)) return;
    event.stopPropagation();
    writeTone(storage, button.dataset.tone);
    paint();
  });
  paint();
  return { getTone: () => readTone(storage) };
}
