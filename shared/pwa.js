import { mountEmbed } from "./embed.js";

if (typeof document !== "undefined") mountEmbed();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const url = new URL("../sw.js", import.meta.url);
    const scope = new URL("./", url);
    navigator.serviceWorker.register(url, { scope: scope.href }).catch(() => {});
  });
}
