const CACHE = "guitar-tools-v7";
const SAMPLE_GUITARS = ["greco", "yamaha"];
const SAMPLE_FRETS = [0, 4, 8, 12];
const ASSETS = [
  "./",
  "./index.html",
  "./favicon.svg",
  "./shared/styles/base.css",
  "./shared/home.js",
  "./shared/soon.js",
  "./shared/registry.js",
  "./shared/pwa.js",
  "./shared/pitch.js",
  "./shared/theory.js",
  "./shared/boxes.js",
  "./shared/diagram.js",
  "./shared/audio.js",
  "./shared/tone.js",
  "./shared/samples/index.js",
  "./chord/",
  "./chord/index.html",
  "./chord/chord.css",
  "./chord/app.js",
  "./chord/explain.js",
  "./chord/scales.js",
  "./chord/state.js",
  "./chord/voicings.js",
  "./chord/voiceleading.js",
  "./chord/triads.js",
  "./metronome/",
  "./metronome/index.html",
  "./metronome/metronome.css",
  "./metronome/app.js",
  "./metronome/timing.js",
  "./log/",
  "./log/index.html",
  "./fretboard/",
  "./fretboard/index.html",
  "./fretboard/fretboard.css",
  "./fretboard/app.js",
  "./fretboard/logic.js",
  "./fretboard/state.js",
  "./fretboard/stats.js",
  "./vendor/tonal/tonal.js",
  "./vendor/chords-db/guitar.js",
];

for (const id of SAMPLE_GUITARS) {
  ASSETS.push(`./shared/samples/${id}/manifest.json`);
  for (let string = 1; string <= 6; string += 1) {
    for (const fret of SAMPLE_FRETS) ASSETS.push(`./shared/samples/${id}/s${string}f${fret}.mp3`);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(
          () =>
            cached ||
            new Response("離線時找不到這個檔案。請先在有網路時開過一次。", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            }),
        );
      return cached || network;
    }),
  );
});
