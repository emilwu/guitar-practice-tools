import { GUITARS, readTone, writeTone } from "./samples/index.js";

export const SAMPLE_LOAD_ERROR = "取樣載入失敗，請重新整理";

export function setSampleStatus(message) {
  if (typeof document === "undefined") return;
  const text = message || "";
  document.querySelectorAll("[data-sample-status]").forEach((el) => {
    el.hidden = !text;
    el.textContent = text;
  });
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

/** Shared guitar-tone control. The choice is stored for every tool. */
export function mountToneSelect(root, storage = globalThis.localStorage) {
  if (!root) return { getTone: () => readTone(storage) };

  function paint() {
    const current = readTone(storage);
    const options = GUITARS.map((guitar) => ({ id: guitar.id, label: guitar.name }));
    root.innerHTML = `<div class="tone-select" role="group" aria-label="吉他音色">
      <span class="tone-label">吉他音色</span>
      <div class="tone-options">${options
        .map(
          (option) =>
            `<button type="button" class="tone-option${option.id === current ? " is-on" : ""}" data-tone="${esc(option.id)}" aria-pressed="${option.id === current ? "true" : "false"}">${esc(option.label)}</button>`,
        )
        .join("")}</div>
      <p class="sample-status" data-sample-status role="status" hidden></p>
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
