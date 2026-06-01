const DB_NAME = "idia-local";
const DB_VERSION = 1;
const STORE_BUTTONS = "buttons";
const STORE_LOGS = "logs";
const DEFAULT_BUTTONS = [
  { name: "Caffe", type: "count", color: "#b45309", size: "medium", target: null },
  { name: "Acqua", type: "count", color: "#0284c7", size: "large", target: { mode: "atLeast", count: 7, days: 7 } },
  { name: "Mood", type: "rating", ratingScale: 5, color: "#7c3aed", size: "medium", target: null },
  { name: "Mal di testa", type: "event", color: "#dc2626", size: "small", target: { mode: "atMost", count: 1, days: 7 } }
];

let db;
let state = {
  buttons: [],
  logs: [],
  activeView: "homeView",
  historyFilter: null,
  ratingButton: null,
  lastCreatedLog: null,
  toastTimer: null
};

const els = {
  addButton: document.querySelector("#addButton"),
  marbleBoard: document.querySelector("#marbleBoard"),
  emptyHome: document.querySelector("#emptyHome"),
  historyFilters: document.querySelector("#historyFilters"),
  historyList: document.querySelector("#historyList"),
  emptyHistory: document.querySelector("#emptyHistory"),
  clearFilters: document.querySelector("#clearFilters"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
  activeCount: document.querySelector("#activeCount"),
  eventCount: document.querySelector("#eventCount"),
  buttonDialog: document.querySelector("#buttonDialog"),
  buttonForm: document.querySelector("#buttonForm"),
  buttonDialogTitle: document.querySelector("#buttonDialogTitle"),
  buttonId: document.querySelector("#buttonId"),
  buttonName: document.querySelector("#buttonName"),
  buttonColor: document.querySelector("#buttonColor"),
  ratingScaleWrap: document.querySelector("#ratingScaleWrap"),
  ratingScale: document.querySelector("#ratingScale"),
  targetMode: document.querySelector("#targetMode"),
  targetCount: document.querySelector("#targetCount"),
  targetDays: document.querySelector("#targetDays"),
  archiveButton: document.querySelector("#archiveButton"),
  ratingDialog: document.querySelector("#ratingDialog"),
  ratingTitle: document.querySelector("#ratingTitle"),
  ratingChoices: document.querySelector("#ratingChoices"),
  toast: document.querySelector("#toast")
};

init();

async function init() {
  db = await openDatabase();
  await seedIfEmpty();
  bindEvents();
  await refresh();
  registerServiceWorker();
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_BUTTONS)) {
        database.createObjectStore(STORE_BUTTONS, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(STORE_LOGS)) {
        const logs = database.createObjectStore(STORE_LOGS, { keyPath: "id" });
        logs.createIndex("buttonId", "buttonId", { unique: false });
        logs.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function tx(storeName, mode = "readonly") {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName).getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function put(storeName, value) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName, "readwrite").put(value);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(value);
  });
}

function remove(storeName, id) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName, "readwrite").delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function seedIfEmpty() {
  const existing = await getAll(STORE_BUTTONS);
  if (existing.length > 0) return;
  const now = new Date().toISOString();
  await Promise.all(DEFAULT_BUTTONS.map((button) => put(STORE_BUTTONS, {
    id: crypto.randomUUID(),
    ratingScale: button.ratingScale,
    icon: "",
    archived: false,
    createdAt: now,
    updatedAt: now,
    ...button
  })));
}

function bindEvents() {
  els.addButton.addEventListener("click", () => openButtonDialog());
  document.querySelector("[data-action='new-button']").addEventListener("click", () => openButtonDialog());
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });
  document.querySelectorAll("[data-action='close-dialog']").forEach((button) => {
    button.addEventListener("click", () => els.buttonDialog.close());
  });
  document.querySelectorAll("[data-action='close-rating']").forEach((button) => {
    button.addEventListener("click", () => els.ratingDialog.close());
  });
  els.buttonForm.addEventListener("submit", saveButton);
  els.buttonForm.elements.type.forEach((radio) => {
    radio.addEventListener("change", updateRatingVisibility);
  });
  els.archiveButton.addEventListener("click", archiveCurrentButton);
  els.clearFilters.addEventListener("click", () => {
    state.historyFilter = null;
    render();
  });
  els.exportData.addEventListener("click", exportData);
  els.importData.addEventListener("change", importData);
}

async function refresh() {
  const [buttons, logs] = await Promise.all([getAll(STORE_BUTTONS), getAll(STORE_LOGS)]);
  state.buttons = buttons.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  state.logs = logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  render();
}

function render() {
  renderHome();
  renderHistory();
  renderBackupStats();
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === state.activeView);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === state.activeView);
  });
}

function renderHome() {
  const activeButtons = state.buttons.filter((button) => !button.archived);
  els.marbleBoard.innerHTML = "";
  els.emptyHome.hidden = activeButtons.length > 0;
  activeButtons.forEach((button, index) => {
    const summary = getButtonSummary(button);
    const target = getTargetState(button);
    const marble = document.createElement("button");
    marble.type = "button";
    marble.className = `marble ${button.size || "medium"} ${target.className}`;
    marble.style.setProperty("--marble-color", button.color || "#3b82f6");
    marble.style.setProperty("--drift-y", `${seededRange(button.id, -8, 10)}px`);
    marble.style.setProperty("--drift-r", `${seededRange(button.name + index, -4, 4)}deg`);
    marble.ariaLabel = `${button.name}, ${summary.accessible}`;
    marble.innerHTML = `
      <span class="marble-content">
        <span class="marble-name">${escapeHtml(button.name)}</span>
        <span class="marble-value">${escapeHtml(summary.value)}</span>
        <span class="marble-target">${escapeHtml(target.label)}</span>
      </span>
    `;
    bindMarblePress(marble, button);
    els.marbleBoard.append(marble);
  });
}

function bindMarblePress(element, button) {
  let longPressTimer;
  let longPressed = false;
  const clear = () => window.clearTimeout(longPressTimer);
  element.addEventListener("pointerdown", () => {
    longPressed = false;
    longPressTimer = window.setTimeout(() => {
      longPressed = true;
      openButtonDialog(button);
    }, 520);
  });
  element.addEventListener("pointerup", () => clear());
  element.addEventListener("pointerleave", () => clear());
  element.addEventListener("pointercancel", () => clear());
  element.addEventListener("click", () => {
    if (longPressed) return;
    recordButton(button);
  });
  element.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openButtonDialog(button);
  });
}

function getButtonSummary(button) {
  const logs = getLogsForButton(button.id);
  const sevenDays = logs.filter((log) => withinDays(log.timestamp, 7));
  if (button.type === "rating") {
    const latest = logs[0];
    const ratings = sevenDays.filter((log) => Number.isFinite(log.value));
    const average = ratings.length ? round(ratings.reduce((sum, log) => sum + log.value, 0) / ratings.length, 1) : null;
    const value = latest ? `${latest.value}/${button.ratingScale || 5}` : "-";
    const accessible = latest ? `ultimo voto ${value}${average ? `, media ultimi 7 giorni ${average}` : ""}` : "nessun voto";
    return { value, accessible };
  }
  if (button.type === "event" && logs[0] && sevenDays.length === 0) {
    return { value: shortRelative(logs[0].timestamp), accessible: `ultimo evento ${formatDateTime(logs[0].timestamp)}` };
  }
  return { value: String(sevenDays.length), accessible: `${sevenDays.length} eventi negli ultimi 7 giorni` };
}

function getTargetState(button) {
  if (!button.target?.mode) return { className: "", label: "7 giorni" };
  const count = getLogsForButton(button.id).filter((log) => withinDays(log.timestamp, button.target.days)).length;
  const { mode, count: targetCount, days } = button.target;
  if (mode === "atLeast") {
    const ratio = count / targetCount;
    if (count >= targetCount) return { className: "target-ok", label: `ok ${count}/${targetCount}` };
    if (ratio >= 0.67) return { className: "target-risk", label: `rischio ${count}/${targetCount}` };
    return { className: "target-out", label: `${count}/${targetCount} in ${days}g` };
  }
  const ratio = count / targetCount;
  if (count <= targetCount * 0.75) return { className: "target-ok", label: `ok ${count}/${targetCount}` };
  if (count <= targetCount) return { className: "target-risk", label: `rischio ${count}/${targetCount}` };
  return { className: "target-out", label: `oltre ${count}/${targetCount}` };
}

function renderHistory() {
  const activeButtons = state.buttons.filter((button) => !button.archived);
  els.historyFilters.innerHTML = "";
  activeButtons.forEach((button) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `filter-chip ${state.historyFilter === button.id ? "active" : ""}`;
    chip.textContent = button.name;
    chip.addEventListener("click", () => {
      state.historyFilter = state.historyFilter === button.id ? null : button.id;
      render();
    });
    els.historyFilters.append(chip);
  });

  const logs = state.logs
    .filter((log) => !state.historyFilter || log.buttonId === state.historyFilter)
    .slice(0, 80);
  els.historyList.innerHTML = "";
  els.emptyHistory.hidden = logs.length > 0;
  logs.forEach((log) => {
    const button = state.buttons.find((item) => item.id === log.buttonId);
    const item = document.createElement("li");
    item.className = "history-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(button?.name || "Bottone archiviato")}</strong>
        <span>${escapeHtml(log.type)}${log.value ? ` · ${escapeHtml(String(log.value))}` : ""}</span>
      </div>
      <time datetime="${escapeHtml(log.timestamp)}">${escapeHtml(formatDateTime(log.timestamp))}</time>
    `;
    els.historyList.append(item);
  });
}

function renderBackupStats() {
  els.activeCount.textContent = state.buttons.filter((button) => !button.archived).length;
  els.eventCount.textContent = state.logs.length;
}

function setView(viewId) {
  state.activeView = viewId;
  render();
}

function openButtonDialog(button = null) {
  els.buttonForm.reset();
  els.buttonId.value = button?.id || "";
  els.buttonDialogTitle.textContent = button ? "Modifica bottone" : "Nuovo bottone";
  els.archiveButton.hidden = !button;
  if (button) {
    els.buttonName.value = button.name;
    els.buttonColor.value = button.color || "#3b82f6";
    setRadio("type", button.type);
    setRadio("size", button.size || "medium");
    els.ratingScale.value = String(button.ratingScale || 5);
    els.targetMode.value = button.target?.mode || "";
    els.targetCount.value = button.target?.count || 3;
    els.targetDays.value = button.target?.days || 7;
  }
  updateRatingVisibility();
  els.buttonDialog.showModal();
  els.buttonName.focus();
}

async function saveButton(event) {
  event.preventDefault();
  const now = new Date().toISOString();
  const id = els.buttonId.value || crypto.randomUUID();
  const existing = state.buttons.find((button) => button.id === id);
  const type = getRadio("type");
  const targetMode = els.targetMode.value;
  const button = {
    id,
    name: els.buttonName.value.trim(),
    type,
    ratingScale: type === "rating" ? Number(els.ratingScale.value) : undefined,
    color: els.buttonColor.value,
    icon: existing?.icon || "",
    size: getRadio("size"),
    target: targetMode ? {
      mode: targetMode,
      count: Number(els.targetCount.value),
      days: Number(els.targetDays.value)
    } : null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    archived: existing?.archived || false
  };
  await put(STORE_BUTTONS, button);
  els.buttonDialog.close();
  await refresh();
}

async function archiveCurrentButton() {
  const id = els.buttonId.value;
  const button = state.buttons.find((item) => item.id === id);
  if (!button) return;
  await put(STORE_BUTTONS, { ...button, archived: true, updatedAt: new Date().toISOString() });
  els.buttonDialog.close();
  await refresh();
  showToast(`${button.name} archiviato`);
}

async function recordButton(button) {
  if (button.type === "rating") {
    openRatingDialog(button);
    return;
  }
  await createLog(button);
}

function openRatingDialog(button) {
  state.ratingButton = button;
  els.ratingTitle.textContent = button.name;
  els.ratingChoices.innerHTML = "";
  const scale = button.ratingScale || 5;
  const step = scale === 100 ? 10 : 1;
  for (let value = step; value <= scale; value += step) {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.textContent = value;
    choice.addEventListener("click", async () => {
      els.ratingDialog.close();
      await createLog(button, value);
    });
    els.ratingChoices.append(choice);
  }
  els.ratingDialog.showModal();
}

async function createLog(button, value) {
  const now = new Date().toISOString();
  const log = {
    id: crypto.randomUUID(),
    buttonId: button.id,
    timestamp: now,
    type: button.type,
    value,
    note: "",
    createdAt: now
  };
  await put(STORE_LOGS, log);
  state.lastCreatedLog = log;
  await refresh();
  showToast(`${button.name} registrato`, {
    label: "Undo",
    action: async () => {
      await remove(STORE_LOGS, log.id);
      state.lastCreatedLog = null;
      await refresh();
      showToast("Registrazione annullata");
    }
  });
}

async function exportData() {
  const payload = {
    app: "IDIA",
    version: 1,
    exportedAt: new Date().toISOString(),
    buttons: state.buttons,
    logs: state.logs
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `idia-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("Backup JSON creato");
}

async function importData(event) {
  const [file] = event.target.files;
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const buttons = Array.isArray(payload.buttons) ? payload.buttons : [];
    const logs = Array.isArray(payload.logs) ? payload.logs : [];
    let importedButtons = 0;
    let importedLogs = 0;
    const existingButtonIds = new Set(state.buttons.map((button) => button.id));
    const existingLogIds = new Set(state.logs.map((log) => log.id));
    for (const button of buttons) {
      if (!button.id || existingButtonIds.has(button.id)) continue;
      await put(STORE_BUTTONS, sanitizeButton(button));
      importedButtons += 1;
    }
    for (const log of logs) {
      if (!log.id || existingLogIds.has(log.id)) continue;
      await put(STORE_LOGS, sanitizeLog(log));
      importedLogs += 1;
    }
    await refresh();
    showToast(`Import: ${importedButtons} bottoni, ${importedLogs} eventi`);
  } catch (error) {
    showToast("File JSON non valido");
  } finally {
    event.target.value = "";
  }
}

function sanitizeButton(button) {
  const now = new Date().toISOString();
  return {
    id: String(button.id),
    name: String(button.name || "Senza nome").slice(0, 28),
    type: ["count", "event", "rating"].includes(button.type) ? button.type : "count",
    ratingScale: [5, 10, 100].includes(Number(button.ratingScale)) ? Number(button.ratingScale) : undefined,
    color: /^#[0-9a-f]{6}$/i.test(button.color) ? button.color : "#3b82f6",
    icon: String(button.icon || ""),
    size: ["small", "medium", "large"].includes(button.size) ? button.size : "medium",
    target: sanitizeTarget(button.target),
    createdAt: button.createdAt || now,
    updatedAt: button.updatedAt || now,
    archived: Boolean(button.archived)
  };
}

function sanitizeLog(log) {
  const now = new Date().toISOString();
  return {
    id: String(log.id),
    buttonId: String(log.buttonId),
    timestamp: log.timestamp || now,
    type: ["count", "event", "rating"].includes(log.type) ? log.type : "count",
    value: Number.isFinite(Number(log.value)) ? Number(log.value) : undefined,
    note: String(log.note || ""),
    createdAt: log.createdAt || now,
    editedAt: log.editedAt
  };
}

function sanitizeTarget(target) {
  if (!target?.mode) return null;
  if (!["atLeast", "atMost"].includes(target.mode)) return null;
  return {
    mode: target.mode,
    count: Math.max(1, Number(target.count) || 1),
    days: Math.max(1, Number(target.days) || 7)
  };
}

function showToast(message, button = null) {
  window.clearTimeout(state.toastTimer);
  els.toast.hidden = false;
  els.toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
  if (button) {
    const action = document.createElement("button");
    action.type = "button";
    action.textContent = button.label;
    action.addEventListener("click", async () => {
      window.clearTimeout(state.toastTimer);
      els.toast.hidden = true;
      await button.action();
    });
    els.toast.append(action);
  }
  state.toastTimer = window.setTimeout(() => {
    els.toast.hidden = true;
  }, 5200);
}

function getLogsForButton(buttonId) {
  return state.logs.filter((log) => log.buttonId === buttonId);
}

function withinDays(timestamp, days) {
  const then = new Date(timestamp).getTime();
  const edge = Date.now() - days * 24 * 60 * 60 * 1000;
  return then >= edge;
}

function setRadio(name, value) {
  const input = els.buttonForm.querySelector(`input[name="${name}"][value="${value}"]`);
  if (input) input.checked = true;
}

function getRadio(name) {
  return els.buttonForm.querySelector(`input[name="${name}"]:checked`).value;
}

function updateRatingVisibility() {
  els.ratingScaleWrap.hidden = getRadio("type") !== "rating";
}

function seededRange(seed, min, max) {
  const str = String(seed);
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const normalized = Math.abs(hash % 1000) / 1000;
  return Math.round(min + normalized * (max - min));
}

function shortRelative(timestamp) {
  const diffDays = Math.floor((Date.now() - new Date(timestamp).getTime()) / 86400000);
  if (diffDays <= 0) return "oggi";
  if (diffDays === 1) return "ieri";
  return `${diffDays}g fa`;
}

function formatDateTime(timestamp) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").catch(() => {
    showToast("Offline non disponibile in questa sessione");
  });
}
