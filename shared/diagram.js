/** SVG fretboard and chord diagrams. No third-party drawing library. */

const KIND = {
  R: "root",
  b3: "third",
  3: "third",
  4: "third",
  2: "third",
  b5: "fifth",
  5: "fifth",
  "#5": "fifth",
  bb7: "seventh",
  b7: "seventh",
  7: "seventh",
};

function kindOf(label) {
  return KIND[label] || "ext";
}

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[ch]));
}

export function describeFrets(frets) {
  return frets
    .map((fret, index) => {
      const stringName = 6 - index;
      if (fret === null) return `${stringName}弦悶`;
      if (fret === 0) return `${stringName}弦空`;
      return `${stringName}弦${fret}格`;
    })
    .join("、");
}

export function chordDiagramSvg(voicing, options = {}) {
  const frets = voicing.frets;
  const fretted = frets.filter((fret) => typeof fret === "number" && fret > 0);
  const min = fretted.length ? Math.min(...fretted) : 1;
  const showNut = min <= 1;
  const base = showNut ? 1 : min;
  const rows = 4;
  const left = 28;
  const top = 32;
  const gapX = 18;
  const gapY = 22;
  const width = left + gapX * 5 + 18;
  const height = top + gapY * rows + 16;
  const stringX = (index) => left + index * gapX;
  const fretY = (row) => top + row * gapY;
  const parts = [];
  parts.push(`<rect class="diagram-card" x="1" y="1" width="${width - 2}" height="${height - 2}" rx="12"></rect>`);
  if (!showNut) {
    parts.push(`<text class="diag-fretnum" x="14" y="${top + gapY * 0.72}" text-anchor="middle">${base}</text>`);
  }
  for (let s = 0; s < 6; s += 1) {
    const x = stringX(s);
    parts.push(`<line class="diag-string" x1="${x}" y1="${top}" x2="${x}" y2="${fretY(rows)}"></line>`);
  }
  for (let r = 0; r <= rows; r += 1) {
    const y = fretY(r);
    const cls = r === 0 && showNut ? "diag-nut" : "diag-fret";
    parts.push(`<line class="${cls}" x1="${left}" y1="${y}" x2="${stringX(5)}" y2="${y}"></line>`);
  }
  for (const barre of voicing.barres || []) {
    const row = barre - base;
    if (row < 0 || row >= rows) continue;
    let from = null;
    let to = null;
    frets.forEach((fret, index) => {
      if (fret === null) return;
      if (fret >= barre) {
        if (from === null || index < from) from = index;
        if (to === null || index > to) to = index;
      }
    });
    if (from === null) continue;
    const y = fretY(row) + gapY / 2;
    parts.push(
      `<rect class="diag-barre" x="${stringX(from)}" y="${y - 5}" width="${stringX(to) - stringX(from)}" height="10" rx="5"></rect>`,
    );
  }
  frets.forEach((fret, index) => {
    const x = stringX(index);
    if (fret === null) {
      parts.push(`<text class="diag-mark" x="${x}" y="20" text-anchor="middle">×</text>`);
      return;
    }
    if (fret === 0) {
      parts.push(`<circle class="diag-open" cx="${x}" cy="14" r="5"></circle>`);
      return;
    }
    const row = fret - base;
    if (row < 0 || row >= rows) return;
    const y = fretY(row) + gapY / 2;
    const note = voicing.notes?.find((item) => item.stringIndex === index);
    const kind = kindOf(note?.label);
    parts.push(`<circle class="dot dot-${kind}" cx="${x}" cy="${y}" r="8"></circle>`);
    if (note?.label) {
      parts.push(`<text class="dot-label" x="${x}" y="${y + 3}" text-anchor="middle">${escapeXml(note.label)}</text>`);
    }
  });
  const title = `${voicing.label || "按法"}，${describeFrets(frets)}`;
  return `<svg class="chord-diagram${options.selected ? " is-selected" : ""}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title>${parts.join("")}</svg>`;
}

export function neckSvg({ markers = [], fretCount = 16 } = {}) {
  const frets = Math.max(12, fretCount);
  const left = 64;
  const top = 16;
  const fretW = 46;
  const stringGap = 28;
  const strings = 6;
  const width = left + frets * fretW + 20;
  const height = top + (strings - 1) * stringGap + 36;
  const nutX = left;
  const stringY = (stringIndex) => top + stringIndex * stringGap;
  const parts = [];
  parts.push(`<rect class="neck-wood" x="0" y="${top - 12}" width="${width}" height="${(strings - 1) * stringGap + 24}" rx="8"></rect>`);
  parts.push(`<rect class="neck-nut" x="${nutX - 5}" y="${top - 12}" width="8" height="${(strings - 1) * stringGap + 24}"></rect>`);
  for (let fret = 1; fret <= frets; fret += 1) {
    const x = nutX + fret * fretW;
    parts.push(`<line class="neck-fret" x1="${x}" y1="${top - 12}" x2="${x}" y2="${top + (strings - 1) * stringGap + 12}"></line>`);
  }
  const inlays = { 3: 1, 5: 1, 7: 1, 9: 1, 12: 2, 15: 1, 17: 1, 19: 1, 21: 1, 24: 2 };
  for (const [fret, count] of Object.entries(inlays)) {
    const n = Number(fret);
    if (n > frets) continue;
    const x = nutX + (n - 0.5) * fretW;
    const mid = top + 2.5 * stringGap;
    if (count === 1) parts.push(`<circle class="inlay" cx="${x}" cy="${mid}" r="4"></circle>`);
    else {
      parts.push(`<circle class="inlay" cx="${x}" cy="${mid - 16}" r="3.5"></circle>`);
      parts.push(`<circle class="inlay" cx="${x}" cy="${mid + 16}" r="3.5"></circle>`);
    }
  }
  for (let s = 0; s < strings; s += 1) {
    const y = stringY(s);
    const stroke = 1 + (5 - s) * 0.35;
    parts.push(`<line class="neck-string" x1="${nutX - 16}" y1="${y}" x2="${nutX + frets * fretW}" y2="${y}" stroke-width="${stroke}"></line>`);
    parts.push(`<text class="string-no" x="18" y="${y + 4}">${6 - s}</text>`);
  }
  for (let fret = 1; fret <= frets; fret += 1) {
    if (![1, 3, 5, 7, 9, 12, 15, 17, 19, 21, 24].includes(fret)) continue;
    const x = nutX + (fret - 0.5) * fretW;
    parts.push(`<text class="fret-num" x="${x}" y="${height - 6}" text-anchor="middle">${fret}</text>`);
  }
  for (const marker of markers) {
    const s = marker.stringIndex;
    const y = stringY(s);
    const x = marker.fret === 0 ? nutX - 28 : nutX + (marker.fret - 0.5) * fretW;
    const cls = `dot dot-${marker.kind || "scale"}`;
    parts.push(`<circle class="${cls}" cx="${x}" cy="${y}" r="${marker.kind === "ghost" ? 5 : 9}"></circle>`);
    if (marker.kind !== "ghost" && marker.label) {
      parts.push(`<text class="dot-label" x="${x}" y="${y + 3}" text-anchor="middle">${escapeXml(marker.label)}</text>`);
    }
  }
  return `<svg class="neck" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="指板，依音程標色">${parts.join("")}</svg>`;
}
