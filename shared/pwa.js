if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const url = new URL("../sw.js", import.meta.url);
    navigator.serviceWorker.register(url).catch(() => {});
  });
}
