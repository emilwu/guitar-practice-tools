import "./pwa.js";
import { TOOLS } from "./registry.js";

const list = document.querySelector("#tool-list");

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

if (list) {
  list.innerHTML = TOOLS.map((tool) => {
    const live = tool.status === "live";
    const pill = live ? `<span class="pill">開始使用</span>` : `<span class="ghost-pill">即將推出</span>`;
    return `<a class="tool${live ? "" : " soon"}" href="${esc(tool.href)}">
      <span class="mark">${esc(tool.id)}</span>
      <span>
        <h2>${esc(tool.name)}</h2>
        <p>${esc(tool.summary)}</p>
      </span>
      ${pill}
    </a>`;
  }).join("");
}
