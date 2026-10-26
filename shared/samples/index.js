/** Guitars available to every tool. Add a folder under shared/samples/ and one entry here. */
export const GUITARS = [
  { id: "greco", folder: "greco", name: "Greco" },
];

export const SYNTH_ID = "synth";
export const TONE_STORAGE_KEY = "guitar-tools.tone.v1";

export function readTone(storage) {
  let id = "";
  try {
    id = storage?.getItem?.(TONE_STORAGE_KEY) || "";
  } catch {
    id = "";
  }
  if (id === SYNTH_ID || GUITARS.some((guitar) => guitar.id === id)) return id;
  return GUITARS[0]?.id || SYNTH_ID;
}

export function writeTone(storage, id) {
  const next = id === SYNTH_ID || GUITARS.some((guitar) => guitar.id === id) ? id : readTone(storage);
  try {
    storage?.setItem?.(TONE_STORAGE_KEY, next);
  } catch {
    /* private mode */
  }
  return next;
}

/**
 * Pick the recorded pluck on the same string.
 * Frets 0–12 use the nearest take (0, 4, 8, 12); a tie keeps the lower fret, so the shift stays within 2 semitones.
 * Frets above 12 always use the fret-12 take and may shift further.
 */
export function nearestSample(samples, stringNumber, fret) {
  const fretNum = Number(fret);
  const stringNum = Number(stringNumber);
  if (!Number.isFinite(fretNum) || fretNum < 0 || !Number.isFinite(stringNum)) return null;
  const onString = (samples || []).filter(
    (sample) => Number(sample.string) === stringNum && Number.isFinite(Number(sample.fret)),
  );
  if (!onString.length) return null;
  const aboveTwelve = fretNum > 12;
  const atTwelve = onString.filter((sample) => Number(sample.fret) === 12);
  const pool = aboveTwelve && atTwelve.length ? atTwelve : onString;
  const anchor = aboveTwelve ? 12 : fretNum;
  let best = null;
  let bestDist = Infinity;
  for (const sample of pool) {
    const sampleFret = Number(sample.fret);
    const dist = Math.abs(sampleFret - anchor);
    if (!best || dist < bestDist || (dist === bestDist && sampleFret < Number(best.fret))) {
      best = sample;
      bestDist = dist;
    }
  }
  return { sample: best, semitones: fretNum - Number(best.fret) };
}

export function playbackRate(semitones) {
  return 2 ** (Number(semitones) / 12);
}

/** Skip MP3 encoder delay that shows up as leading silence after decode. */
export function leadingSilenceOffset(channel, sampleRate, threshold = 0.012) {
  if (!channel?.length || !sampleRate) return 0;
  const cap = Math.min(channel.length, Math.floor(sampleRate * 0.06));
  let index = 0;
  while (index < cap && Math.abs(channel[index]) < threshold) index += 1;
  if (index === 0 || index >= cap) return 0;
  const backoff = Math.floor(sampleRate * 0.0015);
  return Math.max(0, index - backoff) / sampleRate;
}
