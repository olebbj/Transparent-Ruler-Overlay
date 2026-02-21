const STORAGE_KEY = "transparentRulerConfigV1";
const DEFAULT_PX_PER_CM = 37.7952755906;

const COLOR_THEMES = ["steel", "graphite", "ocean", "emerald", "amber", "rose"];
const DENSITY_OPTIONS = ["sparse", "normal", "dense"];
const MIN_LENGTH = 120;
const MAX_LENGTH = 2400;
const MIN_THICKNESS = 32;
const MAX_THICKNESS = 180;

const DEFAULT_GLOBAL = {
  opacity: 0.45,
  density: "normal",
  pxPerCm: DEFAULT_PX_PER_CM,
  calibrated: false,
  theme: "steel",
  showPx: true,
  showCm: true,
  thickness: 72
};

const DEFAULT_SITE = {
  orientation: "horizontal",
  position: {
    x: 12,
    y: 12
  },
  length: 480,
  pinned: false,
  pinnedMode: "current",
  snap: true
};

const elements = {
  toggleBtn: document.getElementById("toggleBtn"),
  orientationH: document.getElementById("orientationH"),
  orientationV: document.getElementById("orientationV"),
  opacityRange: document.getElementById("opacityRange"),
  opacityValue: document.getElementById("opacityValue"),
  thicknessRange: document.getElementById("thicknessRange"),
  thicknessValue: document.getElementById("thicknessValue"),
  lengthRange: document.getElementById("lengthRange"),
  lengthValue: document.getElementById("lengthValue"),
  themeSelect: document.getElementById("themeSelect"),
  showPxToggle: document.getElementById("showPxToggle"),
  showCmToggle: document.getElementById("showCmToggle"),
  densitySelect: document.getElementById("densitySelect"),
  snapToggle: document.getElementById("snapToggle"),
  pinCurrentBtn: document.getElementById("pinCurrentBtn"),
  pinStartBtn: document.getElementById("pinStartBtn"),
  pinEndBtn: document.getElementById("pinEndBtn"),
  unpinBtn: document.getElementById("unpinBtn"),
  calibrateBtn: document.getElementById("calibrateBtn"),
  resetCalibrationBtn: document.getElementById("resetCalibrationBtn"),
  calibrationStatus: document.getElementById("calibrationStatus")
};

const uiState = {
  visible: false,
  orientation: "horizontal",
  opacity: DEFAULT_GLOBAL.opacity,
  density: DEFAULT_GLOBAL.density,
  theme: DEFAULT_GLOBAL.theme,
  showPx: DEFAULT_GLOBAL.showPx,
  showCm: DEFAULT_GLOBAL.showCm,
  thickness: DEFAULT_GLOBAL.thickness,
  length: DEFAULT_SITE.length,
  snap: DEFAULT_SITE.snap,
  pinned: DEFAULT_SITE.pinned,
  pinnedMode: DEFAULT_SITE.pinnedMode,
  calibrated: false,
  pxPerCm: DEFAULT_PX_PER_CM
};

let activeTabId = null;
let hostKey = "__default__";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeTheme(theme) {
  return COLOR_THEMES.includes(theme) ? theme : "steel";
}

function normalizeDensity(density) {
  return DENSITY_OPTIONS.includes(density) ? density : "normal";
}

function normalizePinnedMode(rawMode) {
  if (rawMode === "start" || rawMode === "end" || rawMode === "current") {
    return rawMode;
  }
  return "current";
}

function safeHostFromUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    return parsed.hostname || "__default__";
  } catch (_error) {
    return "__default__";
  }
}

function normalizeSite(rawSite) {
  const site = rawSite && typeof rawSite === "object" ? rawSite : {};
  const orientation = site.orientation === "vertical" ? "vertical" : "horizontal";
  const offsets = site.offsets && typeof site.offsets === "object" ? site.offsets : {};
  const positionRaw = site.position && typeof site.position === "object" ? site.position : {};

  let x = toNumber(positionRaw.x, DEFAULT_SITE.position.x);
  let y = toNumber(positionRaw.y, DEFAULT_SITE.position.y);

  // Backward compatibility with previous site schema that stored single offsets.
  if (!Number.isFinite(toNumber(positionRaw.x, Number.NaN))) {
    if (orientation === "vertical" && Number.isFinite(offsets.vertical)) {
      x = Number(offsets.vertical);
    }
  }
  if (!Number.isFinite(toNumber(positionRaw.y, Number.NaN))) {
    if (orientation === "horizontal" && Number.isFinite(offsets.horizontal)) {
      y = Number(offsets.horizontal);
    }
  }

  return {
    orientation,
    position: { x, y },
    length: clamp(toNumber(site.length, DEFAULT_SITE.length), MIN_LENGTH, MAX_LENGTH),
    pinned: Boolean(site.pinned),
    pinnedMode: normalizePinnedMode(site.pinnedMode || site.pinnedEdge),
    snap: site.snap !== false
  };
}

function normalizeConfig(rawConfig) {
  const cfg = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
  const global = {
    ...DEFAULT_GLOBAL,
    ...(cfg.global || {})
  };

  global.opacity = clamp(toNumber(global.opacity, DEFAULT_GLOBAL.opacity), 0.2, 0.9);
  global.density = normalizeDensity(global.density);
  global.theme = normalizeTheme(global.theme);
  global.pxPerCm = toNumber(global.pxPerCm, DEFAULT_PX_PER_CM);
  if (global.pxPerCm <= 0) {
    global.pxPerCm = DEFAULT_PX_PER_CM;
  }
  global.calibrated = Boolean(global.calibrated);
  global.showPx = global.showPx !== false;
  global.showCm = global.showCm !== false;
  if (!global.showPx && !global.showCm) {
    global.showPx = true;
  }
  global.thickness = clamp(toNumber(global.thickness, DEFAULT_GLOBAL.thickness), MIN_THICKNESS, MAX_THICKNESS);

  const sites = {};
  if (cfg.sites && typeof cfg.sites === "object") {
    for (const [hostname, site] of Object.entries(cfg.sites)) {
      sites[hostname] = normalizeSite(site);
    }
  }

  return {
    version: 1,
    global,
    sites
  };
}

async function loadConfig() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeConfig(stored[STORAGE_KEY]);
}

async function saveConfig(config) {
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
}

async function patchGlobalSettings(patch) {
  const config = await loadConfig();
  config.global = normalizeConfig({
    ...config,
    global: {
      ...config.global,
      ...patch
    }
  }).global;
  await saveConfig(config);
}

async function patchSiteSettings(patch) {
  const config = await loadConfig();
  const existing = normalizeSite(config.sites[hostKey]);
  config.sites[hostKey] = normalizeSite({
    ...existing,
    ...patch
  });
  await saveConfig(config);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab || null;
}

async function relayToActiveTab(payload, inject = false) {
  const response = await chrome.runtime.sendMessage({
    type: "BACKGROUND_RELAY",
    tabId: activeTabId,
    payload,
    inject
  });

  if (response && response.ok && response.state) {
    Object.assign(uiState, response.state);
  }

  return response;
}

function render() {
  elements.toggleBtn.textContent = uiState.visible ? "Turn Off" : "Turn On";
  elements.toggleBtn.classList.toggle("is-off", uiState.visible);

  elements.orientationH.classList.toggle("active", uiState.orientation === "horizontal");
  elements.orientationV.classList.toggle("active", uiState.orientation === "vertical");

  elements.opacityRange.value = String(Math.round(uiState.opacity * 100));
  elements.opacityValue.textContent = `${Math.round(uiState.opacity * 100)}%`;

  elements.thicknessRange.value = String(Math.round(uiState.thickness));
  elements.thicknessValue.textContent = `${Math.round(uiState.thickness)}px`;

  elements.lengthRange.value = String(Math.round(uiState.length));
  elements.lengthValue.textContent = `${Math.round(uiState.length)}px`;

  elements.themeSelect.value = normalizeTheme(uiState.theme);
  elements.densitySelect.value = normalizeDensity(uiState.density);

  elements.showPxToggle.checked = Boolean(uiState.showPx);
  elements.showCmToggle.checked = Boolean(uiState.showCm);
  elements.snapToggle.checked = Boolean(uiState.snap);

  elements.pinCurrentBtn.disabled = uiState.pinned && uiState.pinnedMode === "current";
  elements.pinStartBtn.disabled = uiState.pinned && uiState.pinnedMode === "start";
  elements.pinEndBtn.disabled = uiState.pinned && uiState.pinnedMode === "end";
  elements.unpinBtn.disabled = !uiState.pinned;

  elements.calibrationStatus.textContent = uiState.calibrated
    ? `${uiState.pxPerCm.toFixed(2)} px/cm`
    : "Default";
}

async function bootstrapState() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    throw new Error("No active tab is available.");
  }

  activeTabId = tab.id;
  hostKey = safeHostFromUrl(tab.url || "");

  const config = await loadConfig();
  const site = normalizeSite(config.sites[hostKey]);

  Object.assign(uiState, {
    orientation: site.orientation,
    length: site.length,
    snap: site.snap,
    pinned: site.pinned,
    pinnedMode: site.pinnedMode,
    opacity: config.global.opacity,
    thickness: config.global.thickness,
    density: config.global.density,
    theme: config.global.theme,
    showPx: config.global.showPx,
    showCm: config.global.showCm,
    calibrated: config.global.calibrated,
    pxPerCm: config.global.pxPerCm
  });

  const liveResponse = await relayToActiveTab({ type: "GET_STATE" }, false);
  if (liveResponse && liveResponse.ok && liveResponse.state) {
    Object.assign(uiState, liveResponse.state);
  }
}

async function syncScaleVisibility(changedKey) {
  let showPx = elements.showPxToggle.checked;
  let showCm = elements.showCmToggle.checked;

  if (!showPx && !showCm) {
    if (changedKey === "showPx") {
      showCm = true;
      elements.showCmToggle.checked = true;
    } else {
      showPx = true;
      elements.showPxToggle.checked = true;
    }
  }

  uiState.showPx = showPx;
  uiState.showCm = showCm;

  await patchGlobalSettings({ showPx, showCm });
  await relayToActiveTab({ type: "SET_SCALE_VISIBILITY", showPx, showCm }, false);
  render();
}

function bindEvents() {
  elements.toggleBtn.addEventListener("click", async () => {
    await relayToActiveTab({ type: "TOGGLE_VISIBILITY" }, true);
    render();
  });

  elements.orientationH.addEventListener("click", async () => {
    uiState.orientation = "horizontal";
    await patchSiteSettings({ orientation: "horizontal" });
    await relayToActiveTab({ type: "SET_ORIENTATION", orientation: "horizontal" }, false);
    render();
  });

  elements.orientationV.addEventListener("click", async () => {
    uiState.orientation = "vertical";
    await patchSiteSettings({ orientation: "vertical" });
    await relayToActiveTab({ type: "SET_ORIENTATION", orientation: "vertical" }, false);
    render();
  });

  elements.opacityRange.addEventListener("input", () => {
    const opacity = clamp(toNumber(elements.opacityRange.value, 45) / 100, 0.2, 0.9);
    uiState.opacity = opacity;
    elements.opacityValue.textContent = `${Math.round(opacity * 100)}%`;
    relayToActiveTab({ type: "SET_OPACITY", opacity }, false);
  });

  elements.opacityRange.addEventListener("change", async () => {
    const opacity = clamp(toNumber(elements.opacityRange.value, 45) / 100, 0.2, 0.9);
    uiState.opacity = opacity;
    await patchGlobalSettings({ opacity });
    render();
  });

  elements.thicknessRange.addEventListener("input", () => {
    const thickness = clamp(toNumber(elements.thicknessRange.value, 72), MIN_THICKNESS, MAX_THICKNESS);
    uiState.thickness = thickness;
    elements.thicknessValue.textContent = `${Math.round(thickness)}px`;
    relayToActiveTab({ type: "SET_THICKNESS", thickness }, false);
  });

  elements.thicknessRange.addEventListener("change", async () => {
    const thickness = clamp(toNumber(elements.thicknessRange.value, 72), MIN_THICKNESS, MAX_THICKNESS);
    uiState.thickness = thickness;
    await patchGlobalSettings({ thickness });
    render();
  });

  elements.lengthRange.addEventListener("input", () => {
    const length = clamp(toNumber(elements.lengthRange.value, 480), MIN_LENGTH, MAX_LENGTH);
    uiState.length = length;
    elements.lengthValue.textContent = `${Math.round(length)}px`;
    relayToActiveTab({ type: "SET_LENGTH", length }, false);
  });

  elements.lengthRange.addEventListener("change", async () => {
    const length = clamp(toNumber(elements.lengthRange.value, 480), MIN_LENGTH, MAX_LENGTH);
    uiState.length = length;
    await patchSiteSettings({ length });
    render();
  });

  elements.themeSelect.addEventListener("change", async () => {
    const theme = normalizeTheme(elements.themeSelect.value);
    uiState.theme = theme;
    await patchGlobalSettings({ theme });
    await relayToActiveTab({ type: "SET_THEME", theme }, false);
    render();
  });

  elements.showPxToggle.addEventListener("change", async () => {
    await syncScaleVisibility("showPx");
  });

  elements.showCmToggle.addEventListener("change", async () => {
    await syncScaleVisibility("showCm");
  });

  elements.densitySelect.addEventListener("change", async () => {
    const density = normalizeDensity(elements.densitySelect.value);
    uiState.density = density;
    await patchGlobalSettings({ density });
    await relayToActiveTab({ type: "SET_DENSITY", density }, false);
    render();
  });

  elements.snapToggle.addEventListener("change", async () => {
    const snap = elements.snapToggle.checked;
    uiState.snap = snap;
    await patchSiteSettings({ snap });
    await relayToActiveTab({ type: "SET_SNAP", snap }, false);
    render();
  });

  elements.pinCurrentBtn.addEventListener("click", async () => {
    await patchSiteSettings({ pinned: true, pinnedMode: "current" });
    await relayToActiveTab({ type: "PIN_CURRENT" }, false);
    render();
  });

  elements.pinStartBtn.addEventListener("click", async () => {
    await patchSiteSettings({ pinned: true, pinnedMode: "start" });
    await relayToActiveTab({ type: "PIN_EDGE", edge: "start" }, false);
    render();
  });

  elements.pinEndBtn.addEventListener("click", async () => {
    await patchSiteSettings({ pinned: true, pinnedMode: "end" });
    await relayToActiveTab({ type: "PIN_EDGE", edge: "end" }, false);
    render();
  });

  elements.unpinBtn.addEventListener("click", async () => {
    await patchSiteSettings({ pinned: false });
    await relayToActiveTab({ type: "UNPIN" }, false);
    render();
  });

  elements.calibrateBtn.addEventListener("click", async () => {
    const response = await relayToActiveTab({ type: "START_CALIBRATION" }, true);
    if (response && response.ok && response.state) {
      uiState.calibrated = Boolean(response.state.calibrated);
      uiState.pxPerCm = toNumber(response.state.pxPerCm, DEFAULT_PX_PER_CM);
      render();
    }
  });

  elements.resetCalibrationBtn.addEventListener("click", async () => {
    await patchGlobalSettings({
      calibrated: false,
      pxPerCm: DEFAULT_PX_PER_CM
    });
    uiState.calibrated = false;
    uiState.pxPerCm = DEFAULT_PX_PER_CM;
    await relayToActiveTab({ type: "RESET_CALIBRATION" }, false);
    render();
  });
}

async function init() {
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "CALIBRATION_UPDATED" || !message.state) {
      return;
    }
    uiState.calibrated = Boolean(message.state.calibrated);
    uiState.pxPerCm = toNumber(message.state.pxPerCm, DEFAULT_PX_PER_CM);
    uiState.theme = normalizeTheme(message.state.theme || uiState.theme);
    render();
  });

  bindEvents();
  try {
    await bootstrapState();
  } catch (_error) {
    // Keep popup interactive even if active tab is unavailable.
  }
  render();
}

init();
