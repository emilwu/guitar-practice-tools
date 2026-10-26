/** Back link and compact layout when a tool is opened from the learning map or inside an iframe. */
export const MAP_URL = "https://emilwu.github.io/guitar-learning-map/";

export function embedContext(source = typeof window === "undefined" ? { location: { search: "" } } : window) {
  let inFrame = false;
  try {
    const selfRef = source.self ?? source;
    const topRef = source.top ?? source;
    inFrame = selfRef !== topRef;
  } catch {
    inFrame = true;
  }
  const search = source.location?.search ?? source.search ?? "";
  const fromMap = new URLSearchParams(search).get("from") === "map";
  return { inFrame, fromMap, showBack: inFrame || fromMap };
}

export function mountEmbed(doc = typeof document === "undefined" ? null : document, win = typeof window === "undefined" ? null : window) {
  const ctx = embedContext(win ?? { location: { search: "" } });
  if (!doc?.body) return ctx;
  if (ctx.inFrame) {
    doc.documentElement?.classList?.add("is-embedded");
    doc.body.classList.add("is-embedded");
  }
  if (!ctx.showBack) return ctx;
  let link = doc.querySelector(".embed-back");
  if (!link) {
    link = doc.createElement("a");
    link.className = "embed-back";
    doc.body.prepend(link);
  }
  link.href = MAP_URL;
  link.textContent = "← 回學習地圖";
  if (ctx.inFrame) link.target = "_top";
  else link.removeAttribute("target");
  return ctx;
}
