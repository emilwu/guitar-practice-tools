import { freqFromMidi } from "./pitch.js";

let context = null;

function getContext() {
  if (!context) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    context = new Ctx();
  }
  if (context.state === "suspended") context.resume();
  return context;
}

function pluck(ctx, freq, when, seconds = 1.65) {
  const sampleRate = ctx.sampleRate;
  const period = Math.max(2, Math.round(sampleRate / freq));
  const length = Math.floor(sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  const delay = new Float32Array(period);
  for (let i = 0; i < period; i += 1) delay[i] = Math.random() * 2 - 1;
  let previous = 0;
  const decay = freq > 420 ? 0.982 : 0.993;
  for (let i = 0; i < length; i += 1) {
    const index = i % period;
    const averaged = ((delay[index] + previous) * 0.5) * decay;
    delay[index] = averaged;
    previous = averaged;
    data[i] = averaged;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(Math.min(2800, freq * 7), when);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.13, when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + seconds);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(when);
  source.stop(when + seconds + 0.05);
}

/** Strum a voicing. Call from a tap so iOS Safari unlocks audio. */
export function playNotes(notes) {
  if (!notes?.length || typeof window === "undefined") return;
  const ctx = getContext();
  const start = ctx.currentTime + 0.03;
  const ordered = [...notes].sort((a, b) => b.string - a.string);
  ordered.forEach((note, index) => {
    if (!note.midi) return;
    pluck(ctx, freqFromMidi(note.midi), start + index * 0.028);
  });
}
