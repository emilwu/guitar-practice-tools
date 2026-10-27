import { setSampleStatus, SAMPLE_LOAD_ERROR } from "./tone.js";
import { GUITARS, leadingSilenceOffset, nearestSample, playbackRate, readTone } from "./samples/index.js";

let context = null;
const manifests = new Map();
const buffers = new Map();
let queue = Promise.resolve();

function getContext() {
  if (!context) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    context = new Ctx();
  }
  if (context.state === "suspended") context.resume();
  return context;
}

function guitarById(id) {
  return GUITARS.find((guitar) => guitar.id === id) || GUITARS[0];
}

function loadManifest(guitar) {
  if (!manifests.has(guitar.id)) {
    const url = new URL(`./samples/${guitar.folder}/manifest.json`, import.meta.url);
    const pending = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then((data) => data.samples || []);
    manifests.set(guitar.id, pending);
    pending.catch(() => manifests.delete(guitar.id));
  }
  return manifests.get(guitar.id);
}

function loadBuffer(ctx, url) {
  const key = url.href;
  if (!buffers.has(key)) {
    const pending = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.arrayBuffer();
      })
      .then((raw) => ctx.decodeAudioData(raw.slice(0)));
    buffers.set(key, pending);
    pending.catch(() => buffers.delete(key));
  }
  return buffers.get(key);
}

function playableNotes(notes) {
  return [...notes]
    .filter((note) => note && note.fret != null && note.fret >= 0 && note.midi != null && note.string)
    .sort((a, b) => b.string - a.string);
}

function playSample(ctx, buffer, when, rate) {
  const offset = Math.min(leadingSilenceOffset(buffer.getChannelData(0), buffer.sampleRate), Math.max(0, buffer.duration - 0.05));
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.55, when);
  source.connect(gain);
  gain.connect(ctx.destination);
  const remain = Math.max(0.05, (buffer.duration - offset) / Math.max(rate, 0.25));
  source.start(when, offset);
  source.stop(when + remain + 0.02);
}

function strumSamples(ctx, notes, guitar) {
  return loadManifest(guitar)
    .then((samples) =>
      Promise.all(
        notes.map((note) => {
          const pick = nearestSample(samples, note.string, note.fret);
          if (!pick?.sample?.file) throw new Error("missing sample");
          const url = new URL(`./samples/${guitar.folder}/${pick.sample.file}`, import.meta.url);
          const semitones = Number(note.midi) - Number(pick.sample.midi);
          return loadBuffer(ctx, url).then((buffer) => ({ buffer, rate: playbackRate(semitones) }));
        }),
      ),
    )
    .then((ready) => {
      const start = ctx.currentTime + 0.02;
      ready.forEach((item, index) => playSample(ctx, item.buffer, start + index * 0.028, item.rate));
    });
}

/** Strum recorded samples. Call from a tap so iOS Safari unlocks audio. */
export function playNotes(notes) {
  if (!notes?.length || typeof window === "undefined") return;
  const ctx = getContext();
  const ordered = playableNotes(notes);
  if (!ordered.length) return;
  const guitar = guitarById(readTone(window.localStorage));
  queue = queue
    .catch(() => {})
    .then(() => strumSamples(ctx, ordered, guitar))
    .then(() => setSampleStatus(""))
    .catch(() => setSampleStatus(SAMPLE_LOAD_ERROR));
}
