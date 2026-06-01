const DB_NAME = "idia-local";
const DB_VERSION = 1;
const STORE_BUTTONS = "buttons";
const STORE_LOGS = "logs";
const MS_DAY = 24 * 60 * 60 * 1000;
const DEMO_BUTTONS = [
  { slug: "sigarettes", name: "Sigarettes", type: "count", color: "#7f1d1d", size: "large", target: { mode: "atMost", count: 40, days: 7 } },
  { slug: "coffee", name: "Coffee", type: "count", color: "#92400e", size: "medium", target: { mode: "atMost", count: 21, days: 7 } },
  { slug: "drinks", name: "Drinks", type: "count", color: "#be123c", size: "medium", target: { mode: "atMost", count: 10, days: 7 } },
  { slug: "sex", name: "Sex", type: "count", color: "#db2777", size: "medium", target: null },
  { slug: "impulse-messages", name: "Impulse messages", type: "count", color: "#ea580c", size: "small", target: { mode: "atMost", count: 7, days: 7 } },
  { slug: "water", name: "Water", type: "count", color: "#0284c7", size: "small", target: { mode: "atLeast", count: 28, days: 7 } },
  { slug: "cramp", name: "Cramp", type: "event", color: "#9333ea", size: "small", target: null },
  { slug: "headache", name: "Headache", type: "event", color: "#dc2626", size: "small", target: null },
  { slug: "argument", name: "Argument", type: "event", color: "#c2410c", size: "small", target: null },
  { slug: "night-out", name: "Night out", type: "event", color: "#4f46e5", size: "medium", target: null },
  { slug: "broken-sleep", name: "Broken sleep", type: "event", color: "#64748b", size: "medium", target: null },
  { slug: "impulse-spending", name: "Impulse spending", type: "event", color: "#d97706", size: "small", target: { mode: "atMost", count: 3, days: 7 } },
  { slug: "mood", name: "Mood", type: "rating", ratingScale: 10, color: "#7c3aed", size: "large", target: null },
  { slug: "energy", name: "Energy", type: "rating", ratingScale: 10, color: "#16a34a", size: "medium", target: null },
  { slug: "sleep-quality", name: "Sleep quality", type: "rating", ratingScale: 5, color: "#2563eb", size: "medium", target: null },
  { slug: "meal-quality", name: "Meal quality", type: "rating", ratingScale: 5, color: "#ca8a04", size: "small", target: null },
  { slug: "libido", name: "Libido", type: "rating", ratingScale: 10, color: "#e11d48", size: "medium", target: null },
  { slug: "mental-clarity", name: "Mental clarity", type: "rating", ratingScale: 100, color: "#0f766e", size: "medium", target: null }
];
const CHARTS_BY_TYPE = {
  count: ["rolling-frequency", "timeline", "hour-of-day", "gap", "overlay", "days-with-without"],
  event: ["timeline", "raster", "gap", "hour-of-day", "before-event", "overlay"],
  rating: ["rolling-average", "timeline", "value-distribution", "raster", "overlay", "days-with-without"]
};
const CHART_LABELS = {
  "timeline": "Timeline",
  "rolling-frequency": "Rolling frequency",
  "rolling-average": "Rolling average",
  "raster": "Raster map",
  "hour-of-day": "Hour-of-day",
  "gap": "Gap between events",
  "value-distribution": "Value distribution",
  "overlay": "Overlay",
  "days-with-without": "Days with vs without",
  "before-event": "24h before event"
};

let db;
let state = {
  buttons: [],
  logs: [],
  activeView: "homeView",
  historyFilter: null,
  discovery: {
    buttonId: "",
    compareId: "",
    range: 30,
    chart: ""
  },
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
  resetDemoData: document.querySelector("#resetDemoData"),
  clearAllLogs: document.querySelector("#clearAllLogs"),
  deleteEverything: document.querySelector("#deleteEverything"),
  activeCount: document.querySelector("#activeCount"),
  eventCount: document.querySelector("#eventCount"),
  primaryButtonSelect: document.querySelector("#primaryButtonSelect"),
  compareButtonSelect: document.querySelector("#compareButtonSelect"),
  rangeSelect: document.querySelector("#rangeSelect"),
  chartSelect: document.querySelector("#chartSelect"),
  chartKicker: document.querySelector("#chartKicker"),
  chartTitle: document.querySelector("#chartTitle"),
  chartNote: document.querySelector("#chartNote"),
  chartCanvas: document.querySelector("#chartCanvas"),
  insightList: document.querySelector("#insightList"),
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
  resetButtonLogs: document.querySelector("#resetButtonLogs"),
  duplicateButton: document.querySelector("#duplicateButton"),
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

function clearStore(storeName) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName, "readwrite").clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function seedIfEmpty() {
  const existing = await getAll(STORE_BUTTONS);
  if (existing.length > 0) return;
  await seedDemoData();
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
  els.resetButtonLogs.addEventListener("click", resetCurrentButtonLogs);
  els.duplicateButton.addEventListener("click", duplicateCurrentButton);
  els.clearFilters.addEventListener("click", () => {
    state.historyFilter = null;
    render();
  });
  els.primaryButtonSelect.addEventListener("change", () => {
    state.discovery.buttonId = els.primaryButtonSelect.value;
    const button = state.buttons.find((item) => item.id === state.discovery.buttonId);
    const available = getChartOptions(button);
    if (!available.includes(state.discovery.chart)) state.discovery.chart = available[0] || "";
    render();
  });
  els.compareButtonSelect.addEventListener("change", () => {
    state.discovery.compareId = els.compareButtonSelect.value;
    renderDiscoveryChart();
  });
  els.rangeSelect.addEventListener("change", () => {
    state.discovery.range = Number(els.rangeSelect.value);
    renderDiscoveryChart();
  });
  els.chartSelect.addEventListener("change", () => {
    state.discovery.chart = els.chartSelect.value;
    renderDiscoveryChart();
  });
  els.exportData.addEventListener("click", exportData);
  els.importData.addEventListener("change", importData);
  els.resetDemoData.addEventListener("click", resetDemoData);
  els.clearAllLogs.addEventListener("click", clearAllLogsKeepButtons);
  els.deleteEverything.addEventListener("click", deleteEverything);
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
  renderDiscovery();
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
    if (count >= targetCount) return { className: "target-ok", label: `observed ${count}/${targetCount}` };
    if (ratio >= 0.67) return { className: "target-risk", label: `below ${count}/${targetCount}` };
    return { className: "target-out", label: `${count}/${targetCount} in ${days}g` };
  }
  const ratio = count / targetCount;
  if (count <= targetCount * 0.75) return { className: "target-ok", label: `observed ${count}/${targetCount}` };
  if (count <= targetCount) return { className: "target-risk", label: `near ${count}/${targetCount}` };
  return { className: "target-out", label: `above ${count}/${targetCount}` };
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

function renderDiscovery() {
  const activeButtons = state.buttons.filter((button) => !button.archived);
  if (!activeButtons.length) {
    els.primaryButtonSelect.innerHTML = "";
    els.compareButtonSelect.innerHTML = "";
    els.chartSelect.innerHTML = "";
    els.chartCanvas.innerHTML = `<div class="empty-state compact"><h2>No data</h2><p>Create or seed buttons to explore patterns.</p></div>`;
    els.insightList.innerHTML = "";
    return;
  }
  if (!state.discovery.buttonId || !activeButtons.some((button) => button.id === state.discovery.buttonId)) {
    state.discovery.buttonId = activeButtons[0].id;
  }
  const primary = activeButtons.find((button) => button.id === state.discovery.buttonId);
  const chartOptions = getChartOptions(primary);
  if (!state.discovery.chart || !chartOptions.includes(state.discovery.chart)) {
    state.discovery.chart = chartOptions[0] || "";
  }
  els.primaryButtonSelect.innerHTML = activeButtons.map((button) => {
    return `<option value="${escapeHtml(button.id)}"${button.id === state.discovery.buttonId ? " selected" : ""}>${escapeHtml(button.name)}</option>`;
  }).join("");
  els.compareButtonSelect.innerHTML = [
    `<option value="">None</option>`,
    ...activeButtons
      .filter((button) => button.id !== state.discovery.buttonId)
      .map((button) => `<option value="${escapeHtml(button.id)}"${button.id === state.discovery.compareId ? " selected" : ""}>${escapeHtml(button.name)}</option>`)
  ].join("");
  els.rangeSelect.value = String(state.discovery.range);
  els.chartSelect.innerHTML = chartOptions.map((chart) => {
    return `<option value="${chart}"${chart === state.discovery.chart ? " selected" : ""}>${CHART_LABELS[chart]}</option>`;
  }).join("");
  renderDiscoveryChart();
}

function renderDiscoveryChart() {
  const primary = state.buttons.find((button) => button.id === state.discovery.buttonId);
  const compare = state.buttons.find((button) => button.id === state.discovery.compareId);
  if (!primary) return;
  const range = state.discovery.range;
  const chart = state.discovery.chart;
  els.chartKicker.textContent = primary.type;
  els.chartTitle.textContent = `${CHART_LABELS[chart] || "Statistics"} · ${primary.name}`;
  els.chartNote.hidden = chart !== "overlay" && chart !== "days-with-without" && chart !== "before-event";
  const result = drawChart(chart, primary, compare, range);
  els.chartCanvas.innerHTML = result.svg;
  els.insightList.innerHTML = result.insights.map((item) => `<p>${escapeHtml(item)}</p>`).join("");
}

function renderBackupStats() {
  els.activeCount.textContent = state.buttons.filter((button) => !button.archived).length;
  els.eventCount.textContent = state.logs.length;
}

function setView(viewId) {
  state.activeView = viewId;
  render();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function openButtonDialog(button = null) {
  els.buttonForm.reset();
  els.buttonId.value = button?.id || "";
  els.buttonDialogTitle.textContent = button ? "Modifica bottone" : "Nuovo bottone";
  els.archiveButton.hidden = !button;
  els.resetButtonLogs.hidden = !button;
  els.duplicateButton.hidden = !button;
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

async function resetCurrentButtonLogs() {
  const id = els.buttonId.value;
  const button = state.buttons.find((item) => item.id === id);
  if (!button) return;
  const message = `Reset data for ${button.name}? This keeps the marble and deletes only its logs, useful when you start from a demo shape and make it yours.`;
  if (!window.confirm(message)) return;
  await clearLogsForButton(id);
  els.buttonDialog.close();
  await refresh();
  showToast(`Logs reset for ${button.name}`);
}

async function duplicateCurrentButton() {
  const id = els.buttonId.value;
  const button = state.buttons.find((item) => item.id === id);
  if (!button) return;
  const now = new Date().toISOString();
  await put(STORE_BUTTONS, {
    ...button,
    id: crypto.randomUUID(),
    name: `${button.name} copy`.slice(0, 28),
    createdAt: now,
    updatedAt: now,
    archived: false
  });
  els.buttonDialog.close();
  await refresh();
  showToast(`${button.name} duplicated without data`);
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

async function seedDemoData() {
  const now = new Date();
  const buttons = DEMO_BUTTONS.map((button) => {
    const createdAt = new Date(now.getTime() - 90 * MS_DAY).toISOString();
    return {
      id: demoButtonId(button.slug),
      name: button.name,
      type: button.type,
      ratingScale: button.ratingScale,
      color: button.color,
      icon: "",
      size: button.size,
      target: button.target,
      createdAt,
      updatedAt: createdAt,
      archived: false,
      demo: true
    };
  });
  const logs = generateDemoLogs(buttons, now);
  for (const button of buttons) await put(STORE_BUTTONS, button);
  for (const log of logs) await put(STORE_LOGS, log);
}

async function resetDemoData() {
  if (!window.confirm("Reset all demo data? This restores the demo buttons and synthetic logs. Existing local data will be replaced.")) return;
  await clearStore(STORE_LOGS);
  await clearStore(STORE_BUTTONS);
  await seedDemoData();
  await refresh();
  showToast("Demo data reset");
}

async function clearLogsForButton(buttonId) {
  const logs = await getAll(STORE_LOGS);
  await Promise.all(logs.filter((log) => log.buttonId === buttonId).map((log) => remove(STORE_LOGS, log.id)));
}

async function clearAllLogsKeepButtons() {
  if (!window.confirm("Keep buttons and delete all logs? This is useful after trying the demo and making the schema yours.")) return;
  await clearStore(STORE_LOGS);
  await refresh();
  showToast("All logs deleted, buttons kept");
}

async function deleteEverything() {
  if (!window.confirm("Delete everything from this browser? This removes buttons and logs only on this device.")) return;
  await clearStore(STORE_LOGS);
  await clearStore(STORE_BUTTONS);
  await refresh();
  showToast("Local IDIA data deleted");
}

function generateDemoLogs(buttons, now) {
  const bySlug = Object.fromEntries(DEMO_BUTTONS.map((demo, index) => [demo.slug, buttons[index]]));
  const logs = [];
  const daily = [];
  for (let dayOffset = 89; dayOffset >= 0; dayOffset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset);
    const dayIndex = 89 - dayOffset;
    const dow = date.getDay();
    const weekend = dow === 5 || dow === 6;
    const rnd = seededRandom(`day-${dayIndex}`);
    const nightOut = weekend && rnd > 0.28 || seededRandom(`night-${dayIndex}`) > 0.93;
    const drinks = nightOut ? intRange(`drinks-${dayIndex}`, 2, 7) : (seededRandom(`drink-lite-${dayIndex}`) > 0.82 ? intRange(`drink-small-${dayIndex}`, 1, 2) : 0);
    const brokenSleep = nightOut && seededRandom(`broken-${dayIndex}`) > 0.38 || seededRandom(`broken-r-${dayIndex}`) > 0.9;
    const argument = seededRandom(`arg-${dayIndex}`) > (drinks >= 4 ? 0.78 : 0.93);
    const sleepQuality = clamp(Math.round(4.2 - (nightOut ? 1.2 : 0) - (drinks >= 4 ? 0.8 : 0) - (brokenSleep ? 1.2 : 0) + seededRandom(`sleep-${dayIndex}`) * 1.4), 1, 5);
    const mood = clamp(Math.round(7.2 - (brokenSleep ? 1.4 : 0) - (argument ? 1.5 : 0) - (drinks >= 5 ? 1.1 : 0) + (seededRandom(`mood-${dayIndex}`) - 0.5) * 2.8), 1, 10);
    const energy = clamp(Math.round(7.4 - (5 - sleepQuality) * 0.75 - (nightOut ? 1 : 0) + (seededRandom(`energy-${dayIndex}`) - 0.5) * 2), 1, 10);
    daily.push({ dayIndex, date, nightOut, drinks, brokenSleep, argument, sleepQuality, mood, energy });

    addRepeated(logs, bySlug.coffee, date, intRange(`coffee-${dayIndex}`, 1, weekend ? 3 : 4), [8, 9, 11, 14], dayIndex);
    addRepeated(logs, bySlug.water, date, intRange(`water-${dayIndex}`, 2, 7), [9, 12, 15, 18, 21], dayIndex);
    addRepeated(logs, bySlug.drinks, date, drinks, [20, 21, 22, 23, 0, 1], dayIndex);
    addRepeated(logs, bySlug.sigarettes, date, intRange(`smoke-${dayIndex}`, drinks ? 5 : 1, drinks ? 14 : 6), [17, 19, 21, 23, 0, 1], dayIndex);
    addRepeated(logs, bySlug.sex, date, seededRandom(`sex-${dayIndex}`) > (weekend ? 0.72 : 0.9) ? 1 : 0, [22, 23, 1], dayIndex);
    addRepeated(logs, bySlug["impulse-messages"], date, seededRandom(`msg-${dayIndex}`) > (drinks >= 4 || mood <= 4 ? 0.45 : 0.86) ? intRange(`msgn-${dayIndex}`, 1, 3) : 0, [22, 23, 0, 1], dayIndex);
    addEvent(logs, bySlug["night-out"], date, nightOut, 21, dayIndex);
    addEvent(logs, bySlug["broken-sleep"], date, brokenSleep, 7, dayIndex);
    addEvent(logs, bySlug.argument, date, argument, 22, dayIndex);
    addEvent(logs, bySlug.headache, date, seededRandom(`head-${dayIndex}`) > (drinks >= 4 || sleepQuality <= 2 ? 0.76 : 0.94), 10, dayIndex);
    addEvent(logs, bySlug.cramp, date, seededRandom(`cramp-${dayIndex}`) > (drinks >= 4 || sleepQuality <= 2 ? 0.86 : 0.97), 3, dayIndex);
    addEvent(logs, bySlug["impulse-spending"], date, seededRandom(`spend-${dayIndex}`) > (nightOut ? 0.76 : 0.94), nightOut ? 1 : 17, dayIndex);
    addRating(logs, bySlug["sleep-quality"], date, sleepQuality, 8, dayIndex);
    addRating(logs, bySlug.mood, date, mood, 12, dayIndex);
    addRating(logs, bySlug.energy, date, energy, 13, dayIndex);
    if (seededRandom(`meal-skip-${dayIndex}`) > 0.25) addRating(logs, bySlug["meal-quality"], date, clamp(Math.round(3.4 + (seededRandom(`meal-${dayIndex}`) - 0.5) * 2.4), 1, 5), 20, dayIndex);
    if (seededRandom(`libido-skip-${dayIndex}`) > 0.42) addRating(logs, bySlug.libido, date, clamp(Math.round(5.8 + (weekend ? 0.7 : 0) - (energy <= 4 ? 1.2 : 0) + (seededRandom(`libido-${dayIndex}`) - 0.5) * 3), 1, 10), 18, dayIndex);
    if (seededRandom(`clarity-skip-${dayIndex}`) > 0.18) addRating(logs, bySlug["mental-clarity"], date, clamp(Math.round(74 - (5 - sleepQuality) * 8 - (drinks >= 5 ? 10 : 0) + (seededRandom(`clarity-${dayIndex}`) - 0.5) * 18), 1, 100), 11, dayIndex);
  }
  return logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function addRepeated(logs, button, baseDate, count, hours, dayIndex) {
  for (let i = 0; i < count; i += 1) {
    const hour = hours[i % hours.length];
    addLog(logs, button, demoTimestamp(baseDate, hour, i * 7 + intRange(`${button.id}-${dayIndex}-${i}`, 0, 29)), dayIndex, i);
  }
}

function addEvent(logs, button, baseDate, shouldAdd, hour, dayIndex) {
  if (!shouldAdd) return;
  addLog(logs, button, demoTimestamp(baseDate, hour, intRange(`${button.id}-${dayIndex}`, 0, 45)), dayIndex, 0);
}

function addRating(logs, button, baseDate, value, hour, dayIndex) {
  addLog(logs, button, demoTimestamp(baseDate, hour, intRange(`${button.id}-${dayIndex}`, 0, 45)), dayIndex, 0, value);
}

function addLog(logs, button, timestamp, dayIndex, order, value) {
  logs.push({
    id: uuidFromString(`idia-demo-log-${button.id}-${dayIndex}-${order}-${value ?? "x"}-${timestamp}`),
    buttonId: button.id,
    timestamp,
    type: button.type,
    value,
    note: "",
    createdAt: timestamp,
    demo: true
  });
}

function demoTimestamp(baseDate, hour, minute) {
  const date = new Date(baseDate);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function demoButtonId(slug) {
  return uuidFromString(`idia-demo-button-${slug}`);
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

function getChartOptions(button) {
  if (!button) return [];
  return CHARTS_BY_TYPE[button.type] || ["timeline"];
}

function drawChart(chart, primary, compare, range) {
  const logs = logsInRange(primary.id, range);
  const compareLogs = compare ? logsInRange(compare.id, range) : [];
  if (!logs.length) {
    return {
      svg: `<div class="empty-state compact"><h2>No recent logs</h2><p>This chart will appear when ${escapeHtml(primary.name)} has data in the selected range.</p></div>`,
      insights: [`No ${primary.name} logs in the last ${range} days.`]
    };
  }
  if (chart === "rolling-frequency") return drawRollingFrequency(primary, logs, range);
  if (chart === "rolling-average") return drawRollingAverage(primary, logs, range);
  if (chart === "hour-of-day") return drawHourOfDay(primary, logs, range);
  if (chart === "gap") return drawGap(primary, logs, range);
  if (chart === "value-distribution") return drawValueDistribution(primary, logs, range);
  if (chart === "overlay") return drawOverlay(primary, logs, compare, compareLogs, range);
  if (chart === "days-with-without") return drawDaysWithWithout(primary, compare, range);
  if (chart === "raster") return drawRaster(primary, range);
  if (chart === "before-event") return drawBeforeEvent(primary, logs);
  return drawTimeline(primary, logs, range);
}

function drawTimeline(button, logs, range) {
  const bounds = timeBounds(range);
  const yMax = button.type === "rating" ? button.ratingScale || 10 : 8;
  const points = logs.map((log, index) => {
    const x = scaleTime(log.timestamp, bounds, 44, 748);
    const y = button.type === "rating"
      ? scale(Number(log.value), 1, yMax, 296, 36)
      : 250 - (index % 9) * 18;
    return { x, y, value: log.value, label: formatShortDate(log.timestamp) };
  });
  const path = button.type === "rating" ? linePath(points) : "";
  const marks = points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4"><title>${escapeHtml(point.label)}${point.value ? ` · ${point.value}` : ""}</title></circle>`).join("");
  const yTicks = button.type === "rating" ? numericTicks(1, yMax, 5) : numericTicks(0, 8, 5);
  return {
    svg: chartSvg(`${axes({
      xTicks: dateTicks(bounds.min, bounds.max),
      yTicks,
      yMin: button.type === "rating" ? 1 : 0,
      yMax,
      xLabel: "date",
      yLabel: button.type === "rating" ? `value / ${yMax}` : "event stack"
    })}${path ? `<path d="${path}" class="chart-line"></path>` : ""}<g class="chart-points">${marks}</g>`),
    insights: [
      `${logs.length} ${button.type === "rating" ? "ratings" : "events"} observed in the last ${range} days.`,
      button.type === "rating" ? `Recent value: ${logs[logs.length - 1].value}/${button.ratingScale || 10}.` : `Most recent: ${formatDateTime(logs[logs.length - 1].timestamp)}.`
    ]
  };
}

function drawRollingFrequency(button, logs, range) {
  const days = daySeries(range);
  const points = days.map((day) => {
    const end = day.getTime() + MS_DAY;
    const start = end - 7 * MS_DAY;
    const count = logs.filter((log) => {
      const t = new Date(log.timestamp).getTime();
      return t >= start && t < end;
    }).length;
    return { date: day, value: count };
  });
  return lineChart(points, 0, Math.max(1, ...points.map((p) => p.value)), `${button.name}: rolling 7 days`, [
    `Peak rolling 7-day count: ${Math.max(...points.map((p) => p.value))}.`,
    `This smooths recent frequency without turning it into a streak.`
  ]);
}

function drawRollingAverage(button, logs, range) {
  const days = daySeries(range);
  const points = days.map((day) => {
    const end = day.getTime() + MS_DAY;
    const start = end - 7 * MS_DAY;
    const values = logs.filter((log) => {
      const t = new Date(log.timestamp).getTime();
      return t >= start && t < end && Number.isFinite(log.value);
    }).map((log) => log.value);
    return { date: day, value: values.length ? average(values) : null };
  }).filter((point) => point.value !== null);
  return lineChart(points, 1, button.ratingScale || 10, `${button.name}: rolling average`, [
    `${points.length} rolling-average points in the selected range.`,
    `A rolling average can reveal gentle shifts without over-reading one day.`
  ]);
}

function drawHourOfDay(button, logs) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ label: String(hour), value: 0 }));
  logs.forEach((log) => { buckets[new Date(log.timestamp).getHours()].value += 1; });
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const bars = buckets.map((bucket, index) => {
    const x = 44 + index * 29;
    const h = scale(bucket.value, 0, max, 0, 230);
    return `<rect x="${x}" y="${296 - h}" width="18" height="${h}" rx="3"><title>${bucket.label}:00 · ${bucket.value}</title></rect>`;
  }).join("");
  const labels = buckets.filter((_, i) => i % 3 === 0).map((bucket, i) => `<text x="${48 + i * 87}" y="324">${bucket.label}</text>`).join("");
  const peak = buckets.reduce((best, item) => item.value > best.value ? item : best, buckets[0]);
  return {
    svg: chartSvg(`${axes({
      xTicks: [],
      yTicks: numericTicks(0, max, 5),
      yMin: 0,
      yMax: max,
      xLabel: "hour of day",
      yLabel: "logs"
    })}<g class="chart-bars">${bars}</g><g class="chart-labels">${labels}</g>`),
    insights: [`Most observed hour: ${peak.label}:00 (${peak.value} logs).`, `Hour-of-day can show routine, clustering, or irregularity.`]
  };
}

function drawGap(button, logs) {
  const sorted = [...logs].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const gaps = sorted.slice(1).map((log, index) => ({
    date: new Date(log.timestamp),
    value: round((new Date(log.timestamp).getTime() - new Date(sorted[index].timestamp).getTime()) / 3600000, 1)
  }));
  if (!gaps.length) return { svg: `<div class="empty-state compact"><h2>Need two logs</h2><p>Gap charts need at least two events.</p></div>`, insights: ["Need at least two logs to calculate a gap."] };
  return lineChart(gaps, 0, Math.max(1, ...gaps.map((g) => g.value)), `${button.name}: hours since previous`, [
    `Median gap: ${round(median(gaps.map((g) => g.value)), 1)} hours.`,
    `Gaps describe rhythm and irregularity, not discipline.`
  ]);
}

function drawValueDistribution(button, logs) {
  const scaleMax = button.ratingScale || 10;
  const bucketSize = scaleMax === 100 ? 10 : 1;
  const bucketCount = Math.ceil(scaleMax / bucketSize);
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({ label: `${index * bucketSize + 1}`, value: 0 }));
  logs.forEach((log) => {
    const index = clamp(Math.ceil(log.value / bucketSize) - 1, 0, bucketCount - 1);
    buckets[index].value += 1;
  });
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const width = Math.min(52, 680 / bucketCount - 8);
  const bars = buckets.map((bucket, index) => {
    const x = 50 + index * (700 / bucketCount);
    const h = scale(bucket.value, 0, max, 0, 230);
    return `<rect x="${x}" y="${296 - h}" width="${width}" height="${h}" rx="4"><title>${bucket.label} · ${bucket.value}</title></rect>`;
  }).join("");
  const labels = buckets.map((bucket, index) => `<text x="${54 + index * (700 / bucketCount)}" y="324">${bucket.label}</text>`).join("");
  return {
    svg: chartSvg(`${axes({
      xTicks: [],
      yTicks: numericTicks(0, max, 5),
      yMin: 0,
      yMax: max,
      xLabel: `rating value / ${scaleMax}`,
      yLabel: "logs"
    })}<g class="chart-bars">${bars}</g><g class="chart-labels">${labels}</g>`),
    insights: [`Average value: ${round(average(logs.map((log) => log.value)), 1)}/${scaleMax}.`, `Distribution shows where values cluster without ranking days.`]
  };
}

function drawOverlay(primary, logs, compare, compareLogs, range) {
  if (!compare) {
    return { svg: `<div class="empty-state compact"><h2>Choose a comparison</h2><p>Select a second button to overlay markers.</p></div>`, insights: ["Choose another button to look for visual overlap."] };
  }
  const bounds = timeBounds(range);
  const isValueOverlay = primary.type === "rating";
  const days = daySeries(range);
  const primarySeries = dailySeries(primary, logs, days);
  const compareSeries = dailySeries(compare, compareLogs, days);
  const yMin = isValueOverlay ? 1 : 0;
  const yMax = isValueOverlay
    ? Math.max(primary.ratingScale || 10, compare.type === "rating" ? compare.ratingScale || 10 : 0)
    : Math.max(1, ...primarySeries.map((point) => point.value), ...compareSeries.map((point) => point.value));
  const primaryPoints = primarySeries.map((point) => ({
    x: scale(point.date.getTime(), bounds.min, bounds.max, 44, 748),
    y: scale(point.value, yMin, yMax, 296, 36),
    value: point.value
  }));
  const comparePoints = compareSeries.map((point) => ({
    x: scale(point.date.getTime(), bounds.min, bounds.max, 44, 748),
    y: scale(point.value, yMin, yMax, 296, 36),
    value: point.value
  }));
  const primaryMarks = pointMarkers(primaryPoints, primary.name, "primary");
  const compareMarks = pointMarkers(comparePoints, compare.name, "compare");
  const legend = chartLegend([
    { label: primary.name, className: "legend-primary" },
    { label: compare.name, className: "legend-compare" }
  ]);
  return {
    svg: chartSvg(`${axes({
      xTicks: dateTicks(bounds.min, bounds.max),
      yTicks: numericTicks(yMin, yMax, 5),
      yMin,
      yMax,
      xLabel: "date",
      yLabel: isValueOverlay ? "daily value" : "daily logs"
    })}${legend}<path d="${linePath(primaryPoints)}" class="chart-line overlay-primary-line"></path><path d="${linePath(comparePoints)}" class="chart-line overlay-compare-line"></path><g class="chart-points">${primaryMarks}${compareMarks}</g>`),
    insights: [`${compareLogs.length} ${compare.name} markers over ${logs.length} ${primary.name} logs.`, `Overlap is not causation. Use it as a clue, not proof.`]
  };
}

function drawDaysWithWithout(primary, compare, range) {
  if (!compare) {
    return { svg: `<div class="empty-state compact"><h2>Choose a comparison</h2><p>Select a second button to compare days with and without it.</p></div>`, insights: ["Choose a comparison button first."] };
  }
  const rating = primary.type === "rating" ? primary : compare.type === "rating" ? compare : null;
  const trigger = rating?.id === primary.id ? compare : primary;
  if (!rating || !trigger || rating.id === trigger.id) {
    return { svg: `<div class="empty-state compact"><h2>Needs rating + event/count</h2><p>Use a rating with a count or event button.</p></div>`, insights: ["Days with vs without needs one rating and one count/event."] };
  }
  const days = daySeries(range);
  const triggerDays = new Set(logsInRange(trigger.id, range).map((log) => dateKey(log.timestamp)));
  const ratingByDay = groupByDay(logsInRange(rating.id, range));
  const withValues = [];
  const withoutValues = [];
  days.forEach((day) => {
    const key = dateKey(day);
    const values = (ratingByDay[key] || []).map((log) => log.value).filter(Number.isFinite);
    if (!values.length) return;
    (triggerDays.has(key) ? withValues : withoutValues).push(average(values));
  });
  const withAvg = withValues.length ? average(withValues) : 0;
  const withoutAvg = withoutValues.length ? average(withoutValues) : 0;
  const max = rating.ratingScale || 10;
  const bars = [
    { label: "With", value: withAvg, n: withValues.length, x: 170 },
    { label: "Without", value: withoutAvg, n: withoutValues.length, x: 430 }
  ].map((bar) => {
    const h = scale(bar.value, 0, max, 0, 220);
    return `<g><rect x="${bar.x}" y="${296 - h}" width="120" height="${h}" rx="6"></rect><text x="${bar.x}" y="324">${bar.label} · n=${bar.n}</text><text x="${bar.x}" y="${286 - h}">${round(bar.value, 1)}</text></g>`;
  }).join("");
  return {
    svg: chartSvg(`${axes({
      xTicks: [],
      yTicks: numericTicks(0, max, 6),
      yMin: 0,
      yMax: max,
      xLabel: `${trigger.name} days`,
      yLabel: `${rating.name} avg / ${max}`
    })}<g class="chart-bars">${bars}</g>`),
    insights: [`${rating.name} average with ${trigger.name}: ${round(withAvg, 1)}; without: ${round(withoutAvg, 1)}.`, `This is a possible association, not proof.`]
  };
}

function drawRaster(primary, range) {
  const active = state.buttons.filter((button) => !button.archived).slice(0, 12);
  const days = daySeries(range);
  const cell = Math.max(7, Math.min(18, Math.floor(660 / days.length)));
  const rowH = 22;
  const dayLabels = days.map((day, col) => {
    const interval = range <= 7 ? 1 : range <= 30 ? 5 : 15;
    if (col % interval !== 0 && col !== days.length - 1) return "";
    return `<text x="${112 + col * cell}" y="${Math.max(330, 58 + active.length * rowH)}">${formatShortDate(day)}</text>`;
  }).join("");
  const rows = active.map((button, row) => {
    const byDay = groupByDay(logsInRange(button.id, range));
    const cells = days.map((day, col) => {
      const values = byDay[dateKey(day)] || [];
      const intensity = button.type === "rating" && values.length
        ? average(values.map((log) => log.value)) / (button.ratingScale || 10)
        : Math.min(1, values.length / 6);
      return `<rect x="${112 + col * cell}" y="${34 + row * rowH}" width="${cell - 1}" height="16" rx="2" opacity="${values.length ? 0.24 + intensity * 0.76 : 0.08}"><title>${escapeHtml(button.name)} · ${dateKey(day)} · ${values.length ? values.length : "empty"}</title></rect>`;
    }).join("");
    return `<g class="${button.id === primary.id ? "raster-primary" : ""}"><text x="12" y="${47 + row * rowH}">${escapeHtml(button.name)}</text>${cells}</g>`;
  }).join("");
  return {
    svg: chartSvg(`<g class="raster"><text x="112" y="20" class="chart-title-small">date columns · intensity = daily logs/value</text>${rows}<g class="chart-labels">${dayLabels}</g></g>`, 800, Math.max(360, 92 + active.length * rowH)),
    insights: [`Raster compares up to 12 active buttons across ${range} days.`, `Look for clusters and weekly texture, not perfect days.`]
  };
}

function drawBeforeEvent(primary, logs) {
  if (primary.type === "rating") return drawTimeline(primary, logs, 30);
  const latest = logs[logs.length - 1];
  const end = new Date(latest.timestamp).getTime();
  const start = end - MS_DAY;
  const lines = state.buttons.filter((button) => !button.archived && button.id !== primary.id).map((button) => {
    const recent = state.logs.filter((log) => log.buttonId === button.id && new Date(log.timestamp).getTime() >= start && new Date(log.timestamp).getTime() < end);
    if (!recent.length) return null;
    if (button.type === "rating") return `${button.name}: ${recent[recent.length - 1].value}/${button.ratingScale || 10}`;
    return `${button.name}: ${recent.length}`;
  }).filter(Boolean).slice(0, 8);
  return {
    svg: `<div class="before-card"><h3>Before ${escapeHtml(primary.name)}</h3><p>${escapeHtml(formatDateTime(latest.timestamp))}</p><ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("") || "<li>No other logs in the previous 24h.</li>"}</ul></div>`,
    insights: [`Summary uses the latest ${primary.name} event.`, `Previous-24h context is a discovery prompt, not causality.`]
  };
}

function lineChart(points, minY, maxY, title, insights) {
  if (!points.length) return { svg: `<div class="empty-state compact"><h2>No points</h2><p>Not enough data for this chart.</p></div>`, insights };
  const bounds = { min: points[0].date.getTime(), max: points[points.length - 1].date.getTime() || Date.now() };
  const mapped = points.map((point) => ({
    x: scale(point.date.getTime(), bounds.min, bounds.max, 44, 748),
    y: scale(point.value, minY, maxY, 296, 36),
    value: point.value,
    label: formatShortDate(point.date)
  }));
  const marks = mapped.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="3"><title>${escapeHtml(point.label)} · ${round(point.value, 1)}</title></circle>`).join("");
  return {
    svg: chartSvg(`${axes({
      xTicks: dateTicks(bounds.min, bounds.max),
      yTicks: numericTicks(minY, maxY, 5),
      yMin: minY,
      yMax: maxY,
      xLabel: "date",
      yLabel: title.includes("hours") ? "hours" : title.includes("average") ? "average value" : "rolling count"
    })}<path d="${linePath(mapped)}" class="chart-line"></path><g class="chart-points">${marks}</g><text x="44" y="24" class="chart-title-small">${escapeHtml(title)}</text>`),
    insights
  };
}

function dailySeries(button, logs, days) {
  const byDay = groupByDay(logs);
  return days.map((date) => {
    const values = byDay[dateKey(date)] || [];
    if (button.type === "rating") {
      const ratingValues = values.map((log) => log.value).filter(Number.isFinite);
      return { date, value: ratingValues.length ? average(ratingValues) : null };
    }
    return { date, value: values.length };
  }).filter((point) => point.value !== null);
}

function pointMarkers(points, label, variant) {
  return points.map((point) => {
    return `<circle class="overlay-${variant}-point" cx="${point.x}" cy="${point.y}" r="3"><title>${escapeHtml(label)} · ${round(point.value, 1)}</title></circle>`;
  }).join("");
}

function chartLegend(items) {
  return `<g class="chart-legend">${items.map((item, index) => {
    const x = 70;
    const y = 44 + index * 20;
    return `<g><line x1="${x}" x2="${x + 28}" y1="${y}" y2="${y}" class="${item.className}"></line><text x="${x + 36}" y="${y + 4}">${escapeHtml(item.label)}</text></g>`;
  }).join("")}</g>`;
}

function chartSvg(content, width = 800, height = 350) {
  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img">${content}</svg>`;
}

function dateTicks(min, max) {
  return Array.from({ length: 5 }, (_, index) => {
    const value = min + ((max - min) * index) / 4;
    return {
      x: scale(value, min, max, 44, 748),
      label: formatShortDate(value)
    };
  });
}

function numericTicks(min, max, count) {
  const safeMax = max === min ? min + 1 : max;
  return Array.from({ length: count }, (_, index) => {
    const value = min + ((safeMax - min) * index) / (count - 1);
    return {
      value,
      label: formatAxisNumber(value)
    };
  });
}

function formatAxisNumber(value) {
  if (Math.abs(value) >= 10 || Number.isInteger(value)) return String(Math.round(value));
  return String(round(value, 1));
}

function axes({ xTicks = [], yTicks = [], yMin = 0, yMax = 1, xLabel = "", yLabel = "" } = {}) {
  const x = xTicks.map((tick) => {
    return `<g><line x1="${tick.x}" y1="304" x2="${tick.x}" y2="310"></line><text x="${tick.x}" y="326" text-anchor="middle">${escapeHtml(tick.label)}</text></g>`;
  }).join("");
  const y = yTicks.map((tick) => {
    const yPos = scale(tick.value, yMin, yMax, 296, 36);
    const inside = tick.align === "inside";
    const label = escapeHtml(tick.label ?? formatAxisNumber(tick.value));
    const bg = inside ? `<rect x="49" y="${yPos - 12}" width="${Math.min(128, Math.max(54, label.length * 8 + 14))}" height="19" rx="4" class="axis-label-bg"></rect>` : "";
    return `<g><line x1="38" y1="${yPos}" x2="44" y2="${yPos}"></line><line x1="44" y1="${yPos}" x2="760" y2="${yPos}" class="grid-line"></line>${bg}<text x="${inside ? 56 : 32}" y="${yPos + 4}" text-anchor="${inside ? "start" : "end"}">${label}</text></g>`;
  }).join("");
  return `<g class="chart-axis"><line x1="44" y1="304" x2="760" y2="304"></line><line x1="44" y1="32" x2="44" y2="304"></line>${x}${y}<text x="402" y="344" text-anchor="middle" class="axis-title">${escapeHtml(xLabel)}</text><text x="12" y="170" text-anchor="middle" class="axis-title axis-title-y" transform="rotate(-90 12 170)">${escapeHtml(yLabel)}</text></g>`;
}

function linePath(points) {
  return points.map((point, index) => `${index ? "L" : "M"} ${round(point.x, 1)} ${round(point.y, 1)}`).join(" ");
}

function logsInRange(buttonId, days) {
  const edge = Date.now() - days * MS_DAY;
  return state.logs
    .filter((log) => log.buttonId === buttonId && new Date(log.timestamp).getTime() >= edge)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function daySeries(days) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1 - index));
    return date;
  });
}

function timeBounds(days) {
  const max = Date.now();
  return { min: max - days * MS_DAY, max };
}

function scaleTime(timestamp, bounds, outMin, outMax) {
  return scale(new Date(timestamp).getTime(), bounds.min, bounds.max, outMin, outMax);
}

function scale(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return (outMin + outMax) / 2;
  const t = (value - inMin) / (inMax - inMin);
  return outMin + clamp(t, 0, 1) * (outMax - outMin);
}

function groupByDay(logs) {
  return logs.reduce((groups, log) => {
    const key = dateKey(log.timestamp);
    groups[key] ||= [];
    groups[key].push(log);
    return groups;
  }, {});
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

function seededRandom(seed) {
  const str = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function intRange(seed, min, max) {
  return Math.floor(min + seededRandom(seed) * (max - min + 1));
}

function uuidFromString(input) {
  const hex = Array.from({ length: 32 }, (_, index) => {
    return Math.floor(seededRandom(`${input}-${index}`) * 16).toString(16);
  }).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function shortRelative(timestamp) {
  const diffDays = Math.floor((Date.now() - new Date(timestamp).getTime()) / 86400000);
  if (diffDays <= 0) return "oggi";
  if (diffDays === 1) return "ieri";
  return `${diffDays}g fa`;
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
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
