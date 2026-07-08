const STORAGE_KEY = "bass-learning-records";
const INSTALL_DISMISSED_KEY = "bass-learning-install-dismissed";

const form = document.querySelector("#entryForm");
const recordsList = document.querySelector("#recordsList");
const template = document.querySelector("#recordTemplate");
const dateInput = document.querySelector("#dateInput");
const minutesInput = document.querySelector("#minutesInput");
const topicInput = document.querySelector("#topicInput");
const moodInput = document.querySelector("#moodInput");
const notesInput = document.querySelector("#notesInput");
const todayMinutes = document.querySelector("#todayMinutes");
const streakDays = document.querySelector("#streakDays");
const totalMinutes = document.querySelector("#totalMinutes");
const clearButton = document.querySelector("#clearButton");
const exportButton = document.querySelector("#exportButton");
const exportButtonWide = document.querySelector("#exportButtonWide");
const filterButtons = Array.from(document.querySelectorAll(".filter"));
const presetButtons = Array.from(document.querySelectorAll("#presetButtons button"));
const durationButtons = Array.from(document.querySelectorAll("#durationButtons button"));
const quickSaveButton = document.querySelector("#quickSaveButton");
const todayButton = document.querySelector("#todayButton");
const timerDisplay = document.querySelector("#timerDisplay");
const timerButton = document.querySelector("#timerButton");
const saveTimerButton = document.querySelector("#saveTimerButton");
const installButton = document.querySelector("#installButton");
const installCard = document.querySelector("#installCard");
const installCardButton = document.querySelector("#installCardButton");
const dismissInstallButton = document.querySelector("#dismissInstallButton");
const installDialog = document.querySelector("#installDialog");
const closeInstallDialog = document.querySelector("#closeInstallDialog");
const installTitle = document.querySelector("#installTitle");
const installHint = document.querySelector("#installHint");
const fileModeNotice = document.querySelector("#fileModeNotice");

let records = loadRecords();
let activeFilter = "全部";
let selectedPreset = presetButtons[0];
let selectedDuration = durationButtons[2];
let timerStartedAt = null;
let timerInterval = null;
let deferredInstallPrompt = null;

dateInput.value = toDateInputValue(new Date());
applyPreset(selectedPreset);
applyDuration(selectedDuration);
render();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const entry = {
    id: crypto.randomUUID(),
    date: formData.get("date"),
    minutes: Number(formData.get("minutes")),
    topic: formData.get("topic").trim(),
    type: formData.get("type"),
    mood: formData.get("mood"),
    notes: formData.get("notes").trim(),
    createdAt: new Date().toISOString(),
  };

  records = [entry, ...records];
  saveRecords();
  form.reset();
  dateInput.value = toDateInputValue(new Date());
  moodInput.value = "稳了一点";
  render();
  topicInput.focus();
});

recordsList.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-button");
  if (!button) return;

  records = records.filter((record) => record.id !== button.dataset.id);
  saveRecords();
  render();
});

clearButton.addEventListener("click", () => {
  if (!records.length) return;
  const confirmed = confirm("确定要清空所有学习记录吗？");
  if (!confirmed) return;

  records = [];
  saveRecords();
  render();
});

exportButton.addEventListener("click", exportRecords);
exportButtonWide.addEventListener("click", exportRecords);

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderRecords();
  });
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => applyPreset(button));
});

durationButtons.forEach((button) => {
  button.addEventListener("click", () => applyDuration(button));
});

quickSaveButton.addEventListener("click", () => {
  addRecord({
    date: dateInput.value || toDateInputValue(new Date()),
    minutes: Number(minutesInput.value) || Number(selectedDuration.dataset.minutes),
    topic: topicInput.value.trim() || selectedPreset.dataset.topic,
    type: getSelectedType(),
    mood: moodInput.value,
    notes: notesInput.value.trim(),
  });
});

todayButton.addEventListener("click", () => {
  dateInput.value = toDateInputValue(new Date());
});

timerButton.addEventListener("click", () => {
  if (timerStartedAt) {
    stopTimer(false);
    return;
  }

  timerStartedAt = Date.now();
  timerButton.textContent = "暂停";
  saveTimerButton.disabled = false;
  timerInterval = setInterval(renderTimer, 1000);
  renderTimer();
});

saveTimerButton.addEventListener("click", () => {
  const minutes = Math.max(1, Math.round((Date.now() - timerStartedAt) / 60000));
  stopTimer(true);
  addRecord({
    date: toDateInputValue(new Date()),
    minutes,
    topic: topicInput.value.trim() || selectedPreset.dataset.topic,
    type: getSelectedType(),
    mood: moodInput.value,
    notes: notesInput.value.trim(),
  });
});

installButton.addEventListener("click", openInstallFlow);
installCardButton.addEventListener("click", openInstallFlow);
dismissInstallButton.addEventListener("click", () => {
  localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
  hideInstallPrompt();
});
closeInstallDialog.addEventListener("click", () => installDialog.close());

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installTitle.textContent = "可以一键安装";
  installHint.textContent = "点“装到手机”，浏览器会弹出安装确认。";
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
  hideInstallPrompt();
});

updateInstallMessage();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker
    .register("./sw.js")
    .then((registration) => registration.update())
    .catch(() => {});
}

function openInstallFlow() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.finally(() => {
      deferredInstallPrompt = null;
    });
    return;
  }

  installDialog.showModal();
}

function updateInstallMessage() {
  const isStandalone = isRunningInstalled();
  const isFilePreview = location.protocol === "file:";
  const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";

  if (isStandalone || dismissed) {
    hideInstallPrompt();
    return;
  }

  installCard.hidden = false;
  installButton.hidden = false;

  if (isFilePreview) {
    installTitle.textContent = "先发布，再装到手机";
    installHint.textContent = "现在是本机预览。手机安装需要一个网页地址，做好后就能添加到主屏幕。";
    fileModeNotice.hidden = false;
    return;
  }

  fileModeNotice.hidden = true;
}

function hideInstallPrompt() {
  installCard.hidden = true;
  installButton.hidden = true;
}

function isRunningInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

function addRecord(values) {
  const entry = {
    id: crypto.randomUUID(),
    ...values,
    createdAt: new Date().toISOString(),
  };

  records = [entry, ...records];
  saveRecords();
  notesInput.value = "";
  render();
  showSavedState();
}

function exportRecords() {
  const lines = [
    "日期,分钟,类型,练习内容,手感,备注",
    ...records.map((record) =>
      [
        record.date,
        record.minutes,
        record.type,
        record.topic,
        record.mood,
        record.notes,
      ]
        .map(csvCell)
        .join(",")
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bass-learning-records-${toDateInputValue(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function applyPreset(button) {
  selectedPreset = button;
  presetButtons.forEach((item) => item.classList.toggle("selected", item === button));
  topicInput.value = button.dataset.topic;
  const typeInput = document.querySelector(`input[name="type"][value="${button.dataset.type}"]`);
  if (typeInput) typeInput.checked = true;
}

function applyDuration(button) {
  selectedDuration = button;
  durationButtons.forEach((item) => item.classList.toggle("selected", item === button));
  minutesInput.value = button.dataset.minutes;
}

function getSelectedType() {
  return document.querySelector('input[name="type"]:checked')?.value || "节奏";
}

function renderTimer() {
  if (!timerStartedAt) {
    timerDisplay.textContent = "00:00";
    return;
  }

  const elapsedSeconds = Math.floor((Date.now() - timerStartedAt) / 1000);
  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");
  timerDisplay.textContent = `${minutes}:${seconds}`;
}

function stopTimer(keepDisplay) {
  clearInterval(timerInterval);
  timerInterval = null;
  timerStartedAt = null;
  timerButton.textContent = "开始练习";
  saveTimerButton.disabled = true;
  if (!keepDisplay) renderTimer();
}

function showSavedState() {
  quickSaveButton.textContent = "已保存";
  setTimeout(() => {
    quickSaveButton.textContent = "保存这次练习";
  }, 900);
}

function render() {
  renderStats();
  renderRecords();
}

function renderStats() {
  const today = toDateInputValue(new Date());
  const todayTotal = records
    .filter((record) => record.date === today)
    .reduce((sum, record) => sum + record.minutes, 0);
  const grandTotal = records.reduce((sum, record) => sum + record.minutes, 0);

  todayMinutes.textContent = `${todayTotal} 分钟`;
  totalMinutes.textContent =
    grandTotal < 60 ? `${grandTotal} 分钟` : `${(grandTotal / 60).toFixed(1)} 小时`;
  streakDays.textContent = `${calculateStreak(records)} 天`;
}

function renderRecords() {
  recordsList.innerHTML = "";
  const visibleRecords =
    activeFilter === "全部"
      ? records
      : records.filter((record) => record.type === activeFilter);

  if (!visibleRecords.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent =
      activeFilter === "全部" ? "还没有记录，先保存一次今天的练习。" : "这个类型还没有记录。";
    recordsList.append(empty);
    return;
  }

  visibleRecords
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .forEach((record) => {
      const node = template.content.cloneNode(true);
      node.querySelector(".record-date").textContent = formatDate(record.date);
      node.querySelector(".record-topic").textContent = record.topic;
      node.querySelector(".record-minutes").textContent = `${record.minutes} 分钟`;
      node.querySelector(".record-type").textContent = record.type;
      node.querySelector(".record-mood").textContent = record.mood;
      node.querySelector(".record-notes").textContent = record.notes || "没有备注";
      node.querySelector(".delete-button").dataset.id = record.id;
      recordsList.append(node);
    });
}

function loadRecords() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function calculateStreak(items) {
  const dates = new Set(items.map((record) => record.date));
  let cursor = new Date();
  let count = 0;

  while (dates.has(toDateInputValue(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return count;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}
