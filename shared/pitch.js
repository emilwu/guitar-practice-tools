/** Standard tuning, string index 0 = low E (6th string). */
export const OPEN_PC = [4, 9, 2, 7, 11, 4];
export const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
export const PC_NAME = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

export function mod(n, m) {
  return ((n % m) + m) % m;
}

export function pcAt(stringIndex, fret) {
  return mod(OPEN_PC[stringIndex] + fret, 12);
}

export function midiAt(stringIndex, fret) {
  return OPEN_MIDI[stringIndex] + fret;
}

export function freqFromMidi(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}
