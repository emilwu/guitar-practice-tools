const KEY = "guitar-tools.chord.v1";

export const DEFAULT_STATE = {
  chord: "Am7",
  next: "",
  voicing: "",
  scale: "",
  box: 1,
  prog: "",
};

const HASH_KEYS = ["chord", "next", "voicing", "scale", "box", "prog"];

export function parseHash(hash) {
  const raw = String(hash || "").replace(/^#/, "");
  if (!raw) return null;
  const q = new URLSearchParams(raw);
  if (![...q.keys()].some((k) => HASH_KEYS.includes(k))) return null;
  const box = Number(q.get("box") || DEFAULT_STATE.box);
  return {
    chord: q.get("chord") || DEFAULT_STATE.chord,
    next: q.get("next") || "",
    voicing: q.get("voicing") || "",
    scale: q.get("scale") || "",
    box: box >= 1 && box <= 5 ? box : 1,
    prog: q.get("prog") || "",
  };
}

export function serializeHash(state) {
  const q = new URLSearchParams();
  q.set("chord", state.chord || DEFAULT_STATE.chord);
  if (state.next) q.set("next", state.next);
  if (state.voicing) q.set("voicing", state.voicing);
  if (state.scale) q.set("scale", state.scale);
  if (state.scale && state.box && Number(state.box) !== 1) q.set("box", String(state.box));
  if (state.prog) q.set("prog", state.prog);
  return q.toString();
}

export function loadState(hash, storage) {
  const fromHash = parseHash(hash);
  if (fromHash) return { ...DEFAULT_STATE, ...fromHash };
  try {
    const raw = storage?.getItem?.(KEY);
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    /* ignore broken storage */
  }
  return { ...DEFAULT_STATE };
}

export function saveState(state, storage) {
  try {
    storage?.setItem?.(KEY, JSON.stringify({ ...DEFAULT_STATE, ...state }));
  } catch {
    /* private mode may reject storage */
  }
}
