import { triadMembers } from "../shared/theory.js";

const QUALITIES = [
  { name: "大三和弦", formula: "R 3 5" },
  { name: "小三和弦", formula: "R b3 5" },
  { name: "減三和弦", formula: "R b3 b5" },
  { name: "增三和弦", formula: "R 3 #5" },
];

const UPPER_QUALITY = {
  "4,7": "大三和弦",
  "3,7": "小三和弦",
  "3,6": "減三和弦",
  "4,8": "增三和弦",
};

function mod(n, m) {
  return ((n % m) + m) % m;
}

function qualityOf(labels) {
  const key = labels.join(" ");
  return QUALITIES.find((item) => item.formula === key) || null;
}

function chordSuffix(labels) {
  const key = labels.join(" ");
  if (key === "R 3 5") return "";
  if (key === "R b3 5") return "m";
  if (key === "R b3 b5") return "dim";
  if (key === "R 3 #5") return "aug";
  if (key === "R 4 5") return "sus4";
  if (key === "R 2 5") return "sus2";
  return "";
}

function rotate(items, count) {
  return [...items.slice(count), ...items.slice(0, count)];
}

export function upperTriad(chord) {
  const byInterval = new Map(chord.tones.map((tone) => [tone.interval, tone]));
  const third = byInterval.get("3M") || byInterval.get("3m");
  const fifth = byInterval.get("5P") || byInterval.get("5d") || byInterval.get("5A");
  const seventh = byInterval.get("7M") || byInterval.get("7m") || byInterval.get("7d");
  if (!third || !fifth || !seventh) return null;
  const thirdSpan = mod(fifth.pc - third.pc, 12);
  const fifthSpan = mod(seventh.pc - third.pc, 12);
  const quality = UPPER_QUALITY[`${thirdSpan},${fifthSpan}`];
  if (!quality) return null;
  return {
    quality,
    root: third.display,
    notes: [third.display, fifth.display, seventh.display],
    formula: [third.label, fifth.label, seventh.label].join(" "),
  };
}

function symbolFor(root, labels) {
  return `${root}${chordSuffix(labels)}`;
}

export function triadLesson(chord) {
  const triad = triadMembers(chord);
  if (triad.length < 3) return null;
  const labels = triad.map((tone) => tone.label);
  const names = triad.map((tone) => tone.display);
  const known = qualityOf(labels);
  const spelled = names.join(" ");
  const symbol = symbolFor(names[0], labels);
  const extras = chord.tones.filter((tone) => !triad.some((item) => item.pc === tone.pc));
  const extraText = extras.length
    ? extras.map((tone) => `${tone.display}（${tone.label}）`).join("、")
    : "";
  let relation;
  if (known && extras.length) {
    relation = `${chord.symbol} 先看${known.name} ${symbol}（${spelled}）。${extraText}先拿掉，下面的卡片只按這三個音。`;
  } else if (known) {
    relation = `${chord.symbol} 就是${known.name}（${spelled}），公式 ${known.formula}。三個音都在。`;
  } else {
    relation = `${chord.symbol} 沒有完整的大、小、減、增三度，骨架是 ${symbol}（${spelled}），公式 ${labels.join(" ")}。`;
  }
  const upper = upperTriad(chord);
  const upperText = upper
    ? `另外：七和弦的 3、5、7 自己還是一個三和弦。${chord.symbol} 的上三和弦是${upper.quality} ${upper.root}（${upper.notes.join(" ")}）。下面的卡片練的是 ${symbol}，不是這個。`
    : "";
  const inversions = [0, 1, 2].map((index) => {
    const turnedNames = rotate(names, index);
    const turnedLabels = rotate(labels, index);
    return {
      name: ["根音位置", "第一轉位", "第二轉位"][index],
      bass: turnedLabels[0],
      order: turnedNames.join("–"),
    };
  });
  return {
    qualities: QUALITIES,
    relation,
    upperText,
    inversions,
    symbol,
    names,
  };
}
