"use strict";

const SOURCE = "colab-keepalive";
const LOG_PREFIX = "[Colab-Keepalive]";
const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  intervalSeconds: 60,
  minIntervalSeconds: 30,
  maxIntervalSeconds: 300,
  failureWarningThreshold: 3,
  debugLogging: false
});
const elements = {
  enabled: document.getElementById("enabled"),
  interval: document.getElementById("interval"),
  intervalNumber: document.getElementById("interval-number"),
  intervalOutput: document.getElementById("interval-output"),
  tabCount: document.getElementById("tab-count"),
  lastClick: document.getElementById("last-click"),
  failureCount: document.getElementById("failure-count"),
  liveStatus: document.getElementById("live-status"),
  statusPill: document.getElementById("status-pill"),
  testClick: document.getElementById("test-click"),
  save: document.getElementById("save"),
  reset: document.getElementById("reset"),
  saveState: document.getElementById("save-state"),
  version: document.getElementById("version")
};
const state = {
  settings: { ...DEFAULT_SETTINGS },
  saveTimer: null,
  isSaving: false,
  activeTabCount: 0
};

document.addEventListener("DOMContentLoaded", () => {
  wireEvents();
  void refreshStatus();
  window.setInterval(() => void refreshStatus(), 2000);
});

/**
 * Wires popup controls to autosave, explicit save, reset, and test click behavior.
 * @returns {void}
 */
function wireEvents() {
  elements.enabled.addEventListener("change", () => {
    state.settings.enabled = elements.enabled.checked;
    scheduleSave();
  });
  elements.interval.addEventListener("input", () => syncIntervalInputs(elements.interval.value, true));
  elements.intervalNumber.addEventListener("input", () => syncIntervalInputs(elements.intervalNumber.value, true));
  elements.intervalNumber.addEventListener("change", () => syncIntervalInputs(elements.intervalNumber.value, true, true));
  elements.save.addEventListener("click", () => void saveSettingsNow());
  elements.reset.addEventListener("click", () => {
    state.settings = { ...DEFAULT_SETTINGS };
    applySettingsToUi(DEFAULT_SETTINGS);
    void saveSettingsNow();
  });
  elements.testClick.addEventListener("click", () => void testClickNow());
}

/**
 * Refreshes settings and live status from the service worker.
 * @returns {Promise<void>}
 */
async function refreshStatus() {
  const response = await sendRuntimeMessage("CKA_GET_STATUS", {});
  if (!response.ok) {
    renderError(response.error?.message || "Could not read extension status");
    return;
  }
  const { settings, activeTabCount, aggregateStatus, version } = response.data;
  if (!state.saveTimer && !state.isSaving) {
    state.settings = validateSettings(settings);
    applySettingsToUi(state.settings);
  }
  state.activeTabCount = Number(activeTabCount || 0);
  elements.version.textContent = version || chrome.runtime.getManifest().version;
  renderStatus(activeTabCount, aggregateStatus);
}

/**
 * Saves current settings immediately.
 * @returns {Promise<void>}
 */
async function saveSettingsNow() {
  if (state.saveTimer) {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }
  state.isSaving = true;
  elements.saveState.textContent = "Saving";
  const response = await sendRuntimeMessage("CKA_APPLY_SETTINGS", { settings: state.settings });
  state.isSaving = false;
  if (!response.ok) {
    elements.saveState.textContent = "Error";
    renderError(response.error?.message || "Settings save failed");
    return;
  }
  state.settings = validateSettings(response.data.settings);
  applySettingsToUi(state.settings);
  elements.saveState.textContent = "Saved";
  await refreshStatus();
}

/**
 * Schedules autosave after user input settles.
 * @returns {void}
 */
function scheduleSave() {
  elements.saveState.textContent = "Unsaved";
  if (state.saveTimer) {
    window.clearTimeout(state.saveTimer);
  }
  state.saveTimer = window.setTimeout(() => {
    void saveSettingsNow();
  }, 300);
}

/**
 * Runs an immediate manual click in an open Colab tab.
 * @returns {Promise<void>}
 */
async function testClickNow() {
  elements.testClick.disabled = true;
  elements.testClick.textContent = "Testing...";
  const response = await sendRuntimeMessage("CKA_TEST_CLICK", {});
  if (!response.ok) {
    renderError(response.error?.message || "Test click failed");
  } else {
    elements.saveState.textContent = "Test sent";
  }
  await refreshStatus();
  elements.testClick.textContent = "Test Click Now";
  elements.testClick.disabled = state.activeTabCount === 0;
}

/**
 * Keeps range and number inputs synchronized.
 * @param {string | number} rawValue
 * @param {boolean} shouldSave
 * @param {boolean} [forceClamp]
 * @returns {void}
 */
function syncIntervalInputs(rawValue, shouldSave, forceClamp = false) {
  const min = state.settings.minIntervalSeconds || DEFAULT_SETTINGS.minIntervalSeconds;
  const max = state.settings.maxIntervalSeconds || DEFAULT_SETTINGS.maxIntervalSeconds;
  let value = Number(rawValue);
  if (!Number.isFinite(value)) {
    value = DEFAULT_SETTINGS.intervalSeconds;
  }
  value = Math.round(value / 5) * 5;
  if (forceClamp || value < min || value > max) {
    value = Math.min(max, Math.max(min, value));
  }

  state.settings.intervalSeconds = value;
  elements.interval.value = String(value);
  elements.intervalNumber.value = String(value);
  elements.intervalOutput.textContent = `${value}s`;
  if (shouldSave) {
    scheduleSave();
  }
}

/**
 * Renders settings into form controls.
 * @param {typeof DEFAULT_SETTINGS} settings
 * @returns {void}
 */
function applySettingsToUi(settings) {
  elements.enabled.checked = Boolean(settings.enabled);
  elements.interval.min = String(settings.minIntervalSeconds);
  elements.interval.max = String(settings.maxIntervalSeconds);
  elements.intervalNumber.min = String(settings.minIntervalSeconds);
  elements.intervalNumber.max = String(settings.maxIntervalSeconds);
  elements.interval.value = String(settings.intervalSeconds);
  elements.intervalNumber.value = String(settings.intervalSeconds);
  elements.intervalOutput.textContent = `${settings.intervalSeconds}s`;
}

/**
 * Renders current tab and aggregate status.
 * @param {number} activeTabCount
 * @param {Record<string, unknown>} aggregateStatus
 * @returns {void}
 */
function renderStatus(activeTabCount, aggregateStatus = {}) {
  const count = Number(activeTabCount || 0);
  const failureCount = Number(aggregateStatus.failureCount || 0);
  const stateName = String(aggregateStatus.state || "unknown");
  elements.tabCount.textContent = String(count);
  elements.failureCount.textContent = String(failureCount);
  elements.lastClick.textContent = aggregateStatus.lastClickAt ? formatTimestamp(Number(aggregateStatus.lastClickAt)) : "Never";
  elements.liveStatus.textContent = humanStatus(stateName);
  elements.statusPill.textContent = pillText(stateName, count);
  elements.statusPill.className = `pill ${pillClass(stateName)}`.trim();
  elements.testClick.disabled = count === 0;
}

/**
 * Renders a popup-level error state.
 * @param {string} message
 * @returns {void}
 */
function renderError(message) {
  console.warn(LOG_PREFIX, message);
  elements.liveStatus.textContent = message;
  elements.statusPill.textContent = "Error";
  elements.statusPill.className = "pill error";
}

/**
 * Sends a protocol message to the service worker.
 * @param {string} type
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{ok: boolean, data?: any, error?: {code: string, message: string}}>}
 */
async function sendRuntimeMessage(type, payload) {
  try {
    return await chrome.runtime.sendMessage({
      source: SOURCE,
      type,
      requestId: createRequestId(),
      payload
    });
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "RUNTIME_MESSAGE_FAILED",
        message: error?.message || "Could not reach extension service worker"
      }
    };
  }
}

/**
 * Validates and clamps settings locally for display.
 * @param {Record<string, unknown>} input
 * @returns {typeof DEFAULT_SETTINGS}
 */
function validateSettings(input = {}) {
  const minIntervalSeconds = validNumber(input.minIntervalSeconds, DEFAULT_SETTINGS.minIntervalSeconds, 5, 3600);
  const maxIntervalSeconds = Math.max(
    minIntervalSeconds,
    validNumber(input.maxIntervalSeconds, DEFAULT_SETTINGS.maxIntervalSeconds, minIntervalSeconds, 3600)
  );
  return {
    enabled: typeof input.enabled === "boolean" ? input.enabled : DEFAULT_SETTINGS.enabled,
    intervalSeconds: validNumber(input.intervalSeconds, DEFAULT_SETTINGS.intervalSeconds, minIntervalSeconds, maxIntervalSeconds),
    minIntervalSeconds,
    maxIntervalSeconds,
    failureWarningThreshold: validNumber(
      input.failureWarningThreshold,
      DEFAULT_SETTINGS.failureWarningThreshold,
      1,
      20
    ),
    debugLogging: typeof input.debugLogging === "boolean" ? input.debugLogging : DEFAULT_SETTINGS.debugLogging
  };
}

/**
 * Returns a bounded integer.
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function validNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

/**
 * Formats a timestamp for compact popup display.
 * @param {number} timestamp
 * @returns {string}
 */
function formatTimestamp(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(timestamp));
}

/**
 * Returns human readable status text.
 * @param {string} stateName
 * @returns {string}
 */
function humanStatus(stateName) {
  switch (stateName) {
    case "ready":
      return "Ready";
    case "warning":
      return "Needs attention";
    case "error":
      return "Error";
    case "no-tabs":
      return "No Colab tabs open";
    default:
      return "Waiting";
  }
}

/**
 * Returns pill text for the aggregate state.
 * @param {string} stateName
 * @param {number} count
 * @returns {string}
 */
function pillText(stateName, count) {
  if (count === 0) {
    return "No tabs";
  }
  if (stateName === "error") {
    return "Error";
  }
  if (stateName === "warning") {
    return "Warn";
  }
  return "Ready";
}

/**
 * Returns a CSS class for the aggregate state.
 * @param {string} stateName
 * @returns {string}
 */
function pillClass(stateName) {
  if (stateName === "error") {
    return "error";
  }
  if (stateName === "warning") {
    return "warning";
  }
  if (stateName === "ready") {
    return "ok";
  }
  return "";
}

/**
 * Creates a protocol request identifier.
 * @returns {string}
 */
function createRequestId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
