import "../shared/pwa.js";
import {
  bpmChart,
  bpmSeries,
  createEntry,
  entriesToMarkdown,
  exerciseNames,
  formatClock,
  formatDay,
  formatDuration,
  formatStageWeek,
  fromBackup,
  isBlankEntry,
  loadEntries,
  loadTimer,
  mergeEntries,
  parseHash,
  pauseTimer,
  saveEntries,
  saveTimer,
  serializeHash,
  splitDuration,
  startTimer,
  stopTimer,
  summarize,
  timerElapsedMs,
  toBackup,
  toolLabel,
} from "./log.js";

const clock = document.querySelector("#clock");
const timerState = document.querySelector("#timer-state");
const startBtn = document.querySelector("#timer-start");
const pauseBtn = document.querySelector("#timer-pause");
const stopBtn = document.querySelector("#timer-stop");
const form = document.querySelector("#entry-form");
const formTitle = document.querySelector("#form-title");
const formError = document.querySelector("#form-error");
const saveBtn = document.querySelector("#save");
const cancelEdit = document.querySelector("#cancel-edit");
const dateInput = document.querySelector("#entry-date");
const minutesInput = document.querySelector("#minutes");
const secondsInput = document.querySelector("#seconds");
const stageInput = document.querySelector("#stage");
const weekInput = document.querySelector("#week");
const exerciseInput = document.querySelector("#exercise");
const toolInput = document.querySelector("#tool");
const bpmInput = document.querySelector("#bpm");
const stuckInput = document.querySelector("#stuck");
const chartSelect = document.querySelector("#chart-exercise");
const chartBox = document.querySelector("#chart");
const stuckList = document.querySelector("#stuck-list");
const entryList = document.querySelector("#entry-list");
const backupStatus = document.querySelector("#backup-status");
const preview = document.querySelector("#md-preview");
const importFile = document.querySelector("#import-file");

let entries = loadEntries(localStorage);
let timer = loadTimer(localStorage);
let editingId = null;
let chartPick = "";

function showError(message) {
  if (!message) {
    formError.hidden = true;
    formError.textContent = "";
    return;
  }
  formError.hidden = false;
  formError.textContent = message;
}

function selectedRating() {
  return document.querySelector(".rating[aria-pressed='true']")?.dataset.rating ?? "";
}

function setRating(value) {
  const current = value == null || value === "" ? "" : String(value);
  for (const button of document.querySelectorAll(".rating")) {
    const on = button.dataset.rating === current;
    button.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

function readDraft() {
  return {
    date: dateInput.value,
    minutes: minutesInput.value,
    seconds: secondsInput.value,
    stage: stageInput.value,
    week: weekInput.value,
    exercise: exerciseInput.value,
    tool: toolInput.value,
    bpm: bpmInput.value,
    rating: selectedRating(),
    stuck: stuckInput.value,
  };
}

function applyDraft(draft, { replaceBlanks = false } = {}) {
  if (!draft) return;
  if (draft.date || replaceBlanks) dateInput.value = draft.date || formatDay(new Date());
  if (draft.minutes != null || replaceBlanks) minutesInput.value = draft.minutes == null || draft.minutes === "" ? "0" : String(draft.minutes);
  if (draft.seconds != null || replaceBlanks) secondsInput.value = draft.seconds == null || draft.seconds === "" ? "0" : String(draft.seconds);
  if (draft.stage || replaceBlanks) stageInput.value = draft.stage || "";
  if (draft.week || replaceBlanks) weekInput.value = draft.week || "";
  if (draft.exercise || replaceBlanks) exerciseInput.value = draft.exercise || "";
  if (draft.tool || replaceBlanks) toolInput.value = draft.tool || "";
  if (draft.bpm != null || replaceBlanks) bpmInput.value = draft.bpm == null ? "" : String(draft.bpm);
  if (draft.rating != null || replaceBlanks) setRating(draft.rating || "");
  if (draft.stuck || replaceBlanks) stuckInput.value = draft.stuck || "";
  if (draft.exercise) chartPick = draft.exercise;
}

function writeHash() {
  const hash = serializeHash(readDraft());
  const current = location.hash.replace(/^#/, "");
  if (current === hash) return;
  const next = hash ? `#${hash}` : `${location.pathname}${location.search}`;
  history.replaceState(null, "", next);
}

function blankForm() {
  editingId = null;
  formTitle.textContent = "記下這次";
  saveBtn.textContent = "儲存";
  cancelEdit.hidden = true;
  applyDraft(
    {
      date: formatDay(new Date()),
      minutes: 0,
      seconds: 0,
      stage: stageInput.value,
      week: weekInput.value,
      exercise: exerciseInput.value,
      tool: toolInput.value,
      bpm: bpmInput.value,
      rating: "",
      stuck: "",
    },
    { replaceBlanks: true },
  );
  showError("");
}

function fillFromEntry(entry) {
  editingId = entry.id;
  const parts = splitDuration(entry.durationSec);
  applyDraft(
    {
      date: entry.date,
      minutes: parts.minutes,
      seconds: parts.seconds,
      stage: entry.stage,
      week: entry.week,
      exercise: entry.exercise,
      tool: entry.tool,
      bpm: entry.bpm,
      rating: entry.rating,
      stuck: entry.stuck,
    },
    { replaceBlanks: true },
  );
  formTitle.textContent = "修改這筆";
  saveBtn.textContent = "更新這筆";
  cancelEdit.hidden = false;
  showError("");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function paintTimer() {
  const elapsed = timerElapsedMs(timer, Date.now());
  clock.textContent = formatClock(elapsed);
  const running = timer.status === "running";
  const paused = timer.status === "paused";
  startBtn.textContent = paused ? "繼續" : "開始";
  startBtn.disabled = running;
  pauseBtn.disabled = !running;
  stopBtn.disabled = timer.status === "idle" && elapsed === 0;
  if (running) timerState.textContent = "計時中。離開這個分頁也會繼續算。";
  else if (paused) timerState.textContent = "已暫停。";
  else timerState.textContent = "還沒開始。按開始，或直接在下面手動記。";
}

function persistTimer() {
  saveTimer(timer, localStorage);
  paintTimer();
}

function emptyCopy(text) {
  const p = document.createElement("p");
  p.className = "hint";
  p.textContent = text;
  return p;
}

function renderChart() {
  const names = exerciseNames(entries);
  const preferred = names.includes(chartPick) ? chartPick : chartSelect.value;
  chartSelect.replaceChildren();
  chartBox.replaceChildren();
  if (!names.length) {
    chartSelect.disabled = true;
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "還沒有 BPM";
    chartSelect.append(option);
    chartBox.append(emptyCopy("某個練習有填 BPM 之後，這裡會畫出每次的速度。"));
    return;
  }
  chartSelect.disabled = false;
  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    chartSelect.append(option);
  }
  const pick = names.includes(preferred) ? preferred : names[0];
  chartSelect.value = pick;
  chartPick = pick;
  const chart = bpmChart(bpmSeries(entries, pick));
  const scroll = document.createElement("div");
  scroll.className = "chart-scroll";
  scroll.innerHTML = chart.svg;
  chartBox.append(scroll);
  if (chart.summary) chartBox.append(emptyCopy(chart.summary));
  if (chart.total > chart.shown) chartBox.append(emptyCopy(`圖上是最近 ${chart.shown} 筆，這個練習共 ${chart.total} 筆。`));
}

function renderStuck(items) {
  stuckList.replaceChildren();
  if (!items.length) {
    stuckList.append(emptyCopy("還沒有記下卡點。卡到的地方寫下來，之後才調得了課程。"));
    return;
  }
  for (const entry of items) {
    const card = document.createElement("article");
    card.className = "stuck";
    const title = document.createElement("h3");
    title.textContent = entry.exercise || "未命名的練習";
    const meta = document.createElement("p");
    meta.className = "stuck-meta";
    const bits = [entry.date, formatStageWeek(entry.stage, entry.week), toolLabel(entry.tool)].filter(Boolean);
    meta.textContent = bits.join(" · ");
    const note = document.createElement("p");
    note.textContent = entry.stuck;
    card.append(title, meta, note);
    stuckList.append(card);
  }
}

function renderEntries(list) {
  entryList.replaceChildren();
  if (!entries.length) {
    entryList.append(emptyCopy("還沒有紀錄。練完按停止，或直接寫在上面。"));
    return;
  }
  for (const entry of list) {
    const card = document.createElement("article");
    card.className = "entry";
    const title = document.createElement("h3");
    title.textContent = entry.exercise || "未命名的練習";
    const meta = document.createElement("p");
    meta.className = "entry-meta";
    const bits = [
      entry.date,
      formatStageWeek(entry.stage, entry.week),
      formatDuration(entry.durationSec),
      entry.bpm == null ? "" : `${entry.bpm} BPM`,
      entry.rating == null ? "" : `評分 ${entry.rating}`,
      toolLabel(entry.tool),
    ].filter(Boolean);
    meta.textContent = bits.join(" · ");
    card.append(title, meta);
    if (entry.stuck) {
      const note = document.createElement("p");
      note.textContent = entry.stuck;
      card.append(note);
    }
    const actions = document.createElement("div");
    actions.className = "form-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.dataset.edit = entry.id;
    edit.textContent = "修改";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.delete = entry.id;
    remove.textContent = "刪除";
    remove.setAttribute("aria-label", `刪除 ${entry.date} ${entry.exercise || "這筆紀錄"}`);
    actions.append(edit, remove);
    card.append(actions);
    entryList.append(card);
  }
  if (entries.length > list.length) entryList.append(emptyCopy(`畫面上是最近 ${list.length} 筆，全部有 ${entries.length} 筆。匯出會包含全部。`));
}

function render() {
  const stats = summarize(entries, new Date());
  document.querySelector("#stat-today").textContent = formatDuration(stats.todaySec);
  document.querySelector("#stat-week").textContent = formatDuration(stats.weekSec);
  document.querySelector("#stat-streak").textContent = `${stats.streak} 天`;
  renderChart();
  renderStuck(stats.stuck);
  renderEntries(stats.recent);
  preview.value = entriesToMarkdown(entries);
}

function persistEntries() {
  saveEntries(entries, localStorage);
  render();
}

startBtn.addEventListener("click", () => {
  timer = startTimer(timer, Date.now());
  persistTimer();
});

pauseBtn.addEventListener("click", () => {
  timer = pauseTimer(timer, Date.now());
  persistTimer();
});

stopBtn.addEventListener("click", () => {
  const stopped = stopTimer(timer, Date.now());
  timer = stopped.timer;
  persistTimer();
  if (stopped.elapsedMs < 1000 || editingId) return;
  const parts = splitDuration(stopped.elapsedMs / 1000);
  minutesInput.value = String(parts.minutes);
  secondsInput.value = String(parts.seconds);
  writeHash();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  if (!exerciseInput.value) exerciseInput.focus();
  else stuckInput.focus();
});

document.querySelector(".rating-row").addEventListener("click", (event) => {
  const button = event.target.closest(".rating");
  if (!button) return;
  const next = button.getAttribute("aria-pressed") === "true" ? "" : button.dataset.rating;
  setRating(next);
  writeHash();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const draft = readDraft();
  const existing = entries.find((entry) => entry.id === editingId);
  const entry = createEntry(
    {
      ...draft,
      id: editingId || undefined,
      createdAt: existing?.createdAt,
    },
    new Date(),
  );
  if (isBlankEntry(entry)) {
    showError("先填練習、時長、BPM、評分或卡點。");
    document.querySelector("#save-status").textContent = "";
    return;
  }
  if (editingId) entries = entries.map((item) => (item.id === editingId ? entry : item));
  else entries = [...entries, entry];
  persistEntries();
  const kept = {
    date: entry.date,
    stage: entry.stage,
    week: entry.week,
    exercise: entry.exercise,
    tool: entry.tool,
    bpm: entry.bpm,
  };
  editingId = null;
  formTitle.textContent = "記下這次";
  saveBtn.textContent = "儲存";
  cancelEdit.hidden = true;
  applyDraft({ ...kept, minutes: 0, seconds: 0, rating: "", stuck: "" }, { replaceBlanks: true });
  chartPick = entry.exercise;
  writeHash();
  showError("");
  document.querySelector("#save-status").textContent = "已儲存。";
  backupStatus.textContent = "";
  render();
});

cancelEdit.addEventListener("click", () => {
  const fromHash = parseHash(location.hash);
  editingId = null;
  formTitle.textContent = "記下這次";
  saveBtn.textContent = "儲存";
  cancelEdit.hidden = true;
  dateInput.value = formatDay(new Date());
  minutesInput.value = "0";
  secondsInput.value = "0";
  stageInput.value = "";
  weekInput.value = "";
  exerciseInput.value = "";
  toolInput.value = "";
  bpmInput.value = "";
  setRating("");
  stuckInput.value = "";
  if (fromHash) applyDraft(fromHash);
  showError("");
  writeHash();
});

form.addEventListener("change", () => writeHash());

chartSelect.addEventListener("change", () => {
  chartPick = chartSelect.value;
  render();
});

entryList.addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit]");
  if (edit) {
    const entry = entries.find((item) => item.id === edit.dataset.edit);
    if (entry) fillFromEntry(entry);
    return;
  }
  const remove = event.target.closest("[data-delete]");
  if (!remove) return;
  const entry = entries.find((item) => item.id === remove.dataset.delete);
  const name = entry?.exercise || "這筆紀錄";
  if (!window.confirm(`刪掉「${name}」？這台裝置上的這筆會不見。`)) return;
  entries = entries.filter((item) => item.id !== remove.dataset.delete);
  if (editingId === remove.dataset.delete) blankForm();
  persistEntries();
});

document.querySelector("#export-json").addEventListener("click", () => {
  const doc = toBackup(entries, new Date());
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `practice-log-${formatDay(new Date())}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  backupStatus.textContent = "已下載 JSON。";
});

document.querySelector("#import-json").addEventListener("click", () => importFile.click());

importFile.addEventListener("change", () => {
  const file = importFile.files?.[0];
  importFile.value = "";
  if (!file) return;
  if (file.size > 2_000_000) {
    backupStatus.textContent = "檔案太大，請用這個頁面匯出的 JSON。";
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const incoming = fromBackup(String(reader.result || ""));
      if (!incoming.length) {
        backupStatus.textContent = "沒有讀到可以合併的紀錄。";
        return;
      }
      const before = entries.length;
      entries = mergeEntries(entries, incoming);
      persistEntries();
      backupStatus.textContent = `匯入了 ${incoming.length} 筆。原本 ${before} 筆，現在 ${entries.length} 筆。同一筆 id 以後來的為準。`;
    } catch (error) {
      backupStatus.textContent = error.code === "no-entries" ? error.message : "這份備份讀不起來。";
    }
  });
  reader.readAsText(file);
});

document.querySelector("#copy-md").addEventListener("click", async () => {
  const markdown = entriesToMarkdown(entries);
  preview.value = markdown;
  preview.closest("details").open = true;
  if (!entries.length) {
    backupStatus.textContent = "目前沒有紀錄，複製的是空表格。";
  }
  try {
    await navigator.clipboard.writeText(markdown);
    if (entries.length) backupStatus.textContent = "已複製 Markdown，可以貼進 PRACTICE_LOG.md。";
  } catch {
    preview.focus();
    preview.select();
    backupStatus.textContent = "複製沒有成功，請從下面的預覽手動選取。";
  }
});

window.addEventListener("hashchange", () => {
  const draft = parseHash(location.hash);
  if (draft && !editingId) applyDraft(draft);
  render();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveTimer(timer, localStorage);
  else paintTimer();
});

window.addEventListener("pagehide", () => saveTimer(timer, localStorage));

const initial = parseHash(location.hash);
dateInput.value = formatDay(new Date());
if (initial) applyDraft(initial);
paintTimer();
render();
setInterval(paintTimer, 250);
