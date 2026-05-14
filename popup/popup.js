"use strict";

const {
	DEFAULT_SETTINGS,
	JITTER_MIN,
	JITTER_MAX,
	LOG_PREFIX,
	SOURCE,
	createRequestId,
	validateSettings,
} = globalThis.ColabKeepaliveShared;

const elements = {
	enabled: document.getElementById("enabled"),
	interval: document.getElementById("interval"),
	intervalNumber: document.getElementById("interval-number"),
	intervalOutput: document.getElementById("interval-output"),
	jitter: document.getElementById("jitter"),
	jitterNumber: document.getElementById("jitter-number"),
	jitterOutput: document.getElementById("jitter-output"),
	tabCount: document.getElementById("tab-count"),
	lastClick: document.getElementById("last-click"),
	failureCount: document.getElementById("failure-count"),
	uptime: document.getElementById("uptime"),
	statusPill: document.getElementById("status-pill"),
	testClick: document.getElementById("test-click"),
	save: document.getElementById("save"),
	reset: document.getElementById("reset"),
	saveState: document.getElementById("save-state"),
	version: document.getElementById("version"),
	themeToggle: document.getElementById("theme-toggle"),
	humanizeSignals: document.getElementById("humanize-signals"),
	simulateActivity: document.getElementById("simulate-activity"),
	dismissDialogs: document.getElementById("dismiss-dialogs"),
	browserNotifications: document.getElementById("browser-notifications"),
	keyboardShortcuts: document.getElementById("keyboard-shortcuts"),
	notificationPerm: document.getElementById("notification-perm"),
	wakeLockIndicator: document.getElementById("wake-lock-indicator"),
	activityIndicator: document.getElementById("activity-indicator"),
	dismissIndicator: document.getElementById("dismiss-indicator"),
	clearErrors: document.getElementById("clear-errors"),
	errorMessage: document.getElementById("error-message"),
};

const state = {
	settings: { ...DEFAULT_SETTINGS },
	saveTimer: null,
	isSaving: false,
	activeTabCount: 0,
};

const THEME_CYCLE = ["auto", "light", "dark"];

/** @returns {void} */
function applyTheme(theme) {
	const html = document.documentElement;
	if (theme === "light") {
		html.setAttribute("data-theme", "light");
	} else if (theme === "dark") {
		html.setAttribute("data-theme", "dark");
	} else {
		html.removeAttribute("data-theme");
	}
}

/** @returns {string} */
function nextTheme(current) {
	const idx = THEME_CYCLE.indexOf(current);
	return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
}

/** @returns {string} */
function themeIcon(theme) {
	switch (theme) {
		case "light":
			return "☀";
		case "dark":
			return "☾";
		default:
			return "◐";
	}
}

document.addEventListener("DOMContentLoaded", () => {
	wireEvents();
	void refreshStatus();
	window.setInterval(() => void refreshStatus(), 2000);
});

/** @returns {void} */
function wireEvents() {
	elements.enabled.addEventListener("change", () => {
		state.settings.enabled = elements.enabled.checked;
		scheduleSave();
	});

	elements.interval.addEventListener("input", () =>
		syncIntervalInputs(elements.interval.value, true),
	);
	elements.intervalNumber.addEventListener("input", () =>
		syncIntervalInputs(elements.intervalNumber.value, true),
	);
	elements.intervalNumber.addEventListener("change", () =>
		syncIntervalInputs(elements.intervalNumber.value, true, true),
	);

	elements.jitter.addEventListener("input", () =>
		syncJitterInputs(elements.jitter.value, true),
	);
	elements.jitterNumber.addEventListener("input", () =>
		syncJitterInputs(elements.jitterNumber.value, true),
	);
	elements.jitterNumber.addEventListener("change", () =>
		syncJitterInputs(elements.jitterNumber.value, true, true),
	);

	elements.humanizeSignals.addEventListener("change", () => {
		state.settings.humanizeSignals = elements.humanizeSignals.checked;
		scheduleSave();
	});
	elements.simulateActivity.addEventListener("change", () => {
		state.settings.simulateActivity = elements.simulateActivity.checked;
		scheduleSave();
	});
	elements.dismissDialogs.addEventListener("change", () => {
		state.settings.dismissDialogs = elements.dismissDialogs.checked;
		scheduleSave();
	});
	elements.browserNotifications.addEventListener("change", () => {
		state.settings.browserNotifications = elements.browserNotifications.checked;
		scheduleSave();
	});
	elements.keyboardShortcuts.addEventListener("change", () => {
		state.settings.keyboardShortcuts = elements.keyboardShortcuts.checked;
		scheduleSave();
	});

	elements.themeToggle.addEventListener("click", () => {
		const next = nextTheme(state.settings.theme);
		state.settings.theme = next;
		applyTheme(next);
		elements.themeToggle.textContent = themeIcon(next);
		scheduleSave();
	});

	elements.save.addEventListener("click", () => void saveSettingsNow());
	elements.reset.addEventListener("click", () => {
		state.settings = { ...DEFAULT_SETTINGS };
		applySettingsToUi(DEFAULT_SETTINGS);
		void saveSettingsNow();
	});
	elements.testClick.addEventListener("click", () => void testClickNow());
	elements.clearErrors.addEventListener("click", () => void clearErrorsNow());
}

/** @returns {Promise<void>} */
async function refreshStatus() {
	const response = await sendRuntimeMessage("CKA_GET_STATUS", {});
	if (!response.ok) {
		renderError(response.error?.message || "Could not read extension status");
		return;
	}
	const {
		settings,
		activeTabCount,
		aggregateStatus,
		uptime,
		notificationPermitted,
		version,
	} = response.data;

	if (!state.saveTimer && !state.isSaving) {
		state.settings = validateSettings(settings);
		applySettingsToUi(state.settings);
	}
	state.activeTabCount = Number(activeTabCount || 0);
	elements.version.textContent =
		version || chrome.runtime.getManifest().version;
	renderStatus(activeTabCount, aggregateStatus, uptime, notificationPermitted);
}

/** @returns {Promise<void>} */
async function saveSettingsNow() {
	if (state.saveTimer) {
		window.clearTimeout(state.saveTimer);
		state.saveTimer = null;
	}
	state.isSaving = true;
	elements.saveState.textContent = "Saving";
	const response = await sendRuntimeMessage("CKA_APPLY_SETTINGS", {
		settings: state.settings,
	});
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

/** @returns {void} */
function scheduleSave() {
	elements.saveState.textContent = "Unsaved";
	if (state.saveTimer) {
		window.clearTimeout(state.saveTimer);
	}
	state.saveTimer = window.setTimeout(() => {
		void saveSettingsNow();
	}, 300);
}

/** @returns {Promise<void>} */
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

/** @returns {Promise<void>} */
async function clearErrorsNow() {
	elements.clearErrors.disabled = true;
	elements.clearErrors.textContent = "Clearing...";
	const response = await sendRuntimeMessage("CKA_CLEAR_ERRORS", {});
	if (!response.ok) {
		renderError(response.error?.message || "Could not clear errors");
	} else {
		elements.saveState.textContent = "Cleared";
	}
	await refreshStatus();
	elements.clearErrors.textContent = "Clear Errors";
	elements.clearErrors.disabled = false;
}

/**
 * @param {string | number} rawValue
 * @param {boolean} shouldSave
 * @param {boolean} [forceClamp]
 * @returns {void}
 */
function syncIntervalInputs(rawValue, shouldSave, forceClamp = false) {
	const min =
		state.settings.minIntervalSeconds || DEFAULT_SETTINGS.minIntervalSeconds;
	const max =
		state.settings.maxIntervalSeconds || DEFAULT_SETTINGS.maxIntervalSeconds;
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
 * @param {string | number} rawValue
 * @param {boolean} shouldSave
 * @param {boolean} [forceClamp]
 * @returns {void}
 */
function syncJitterInputs(rawValue, shouldSave, forceClamp = false) {
	let value = Number(rawValue);
	if (!Number.isFinite(value)) {
		value = Math.round(DEFAULT_SETTINGS.jitterRange * 100);
	}
	value = Math.round(value);
	const jitterMin = Math.round(JITTER_MIN * 100);
	const jitterMax = Math.round(JITTER_MAX * 100);
	if (forceClamp || value < jitterMin || value > jitterMax) {
		value = Math.min(jitterMax, Math.max(jitterMin, value));
	}

	const ratio = value / 100;
	state.settings.jitterRange = ratio;
	elements.jitter.value = String(value);
	elements.jitterNumber.value = String(value);
	elements.jitterOutput.textContent = `${value}%`;
	if (shouldSave) {
		scheduleSave();
	}
}

/**
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

	const jitterPercent = Math.round(
		(settings.jitterRange || DEFAULT_SETTINGS.jitterRange) * 100,
	);
	elements.jitter.value = String(jitterPercent);
	elements.jitterNumber.value = String(jitterPercent);
	elements.jitterOutput.textContent = `${jitterPercent}%`;

	elements.humanizeSignals.checked = Boolean(settings.humanizeSignals);
	elements.simulateActivity.checked = Boolean(settings.simulateActivity);
	elements.dismissDialogs.checked = Boolean(settings.dismissDialogs);
	elements.browserNotifications.checked = Boolean(
		settings.browserNotifications,
	);
	elements.keyboardShortcuts.checked = Boolean(settings.keyboardShortcuts);

	const theme = settings.theme || "auto";
	applyTheme(theme);
	elements.themeToggle.textContent = themeIcon(theme);
}

/**
 * @param {number} activeTabCount
 * @param {Record<string, unknown>} aggregateStatus
 * @param {{totalUptimeMs: number, totalUptimeFormatted: string}} [uptimeData]
 * @param {boolean} [notificationPermitted]
 * @returns {void}
 */
function renderStatus(
	activeTabCount,
	aggregateStatus = {},
	uptimeData,
	notificationPermitted,
) {
	const count = Number(activeTabCount || 0);
	const failureCount = Number(aggregateStatus.failureCount || 0);
	const stateName = String(aggregateStatus.state || "unknown");

	elements.tabCount.textContent = String(count);
	elements.failureCount.textContent = String(failureCount);
	elements.lastClick.textContent = aggregateStatus.lastClickAt
		? formatTimestamp(Number(aggregateStatus.lastClickAt))
		: "Never";
	elements.uptime.textContent = uptimeData?.totalUptimeFormatted || "0s";

	elements.statusPill.textContent = pillText(stateName, count);
	elements.statusPill.className = `pill ${pillClass(stateName)}`.trim();
	elements.testClick.disabled = count === 0;

	const wakeLockActive = Boolean(aggregateStatus.wakeLockActive);
	const humanizeActive = Boolean(aggregateStatus.humanizeActive);
	const dismissDetected = Boolean(aggregateStatus.dismissDialogDetected);

	elements.wakeLockIndicator.setAttribute(
		"data-active",
		String(wakeLockActive),
	);
	elements.activityIndicator.setAttribute(
		"data-active",
		String(humanizeActive),
	);
	elements.dismissIndicator.setAttribute(
		"data-active",
		String(dismissDetected),
	);

	if (typeof notificationPermitted === "boolean") {
		elements.notificationPerm.setAttribute(
			"data-permitted",
			notificationPermitted ? "granted" : "denied",
		);
		elements.notificationPerm.textContent = notificationPermitted
			? "Granted"
			: "Blocked";
	} else {
		elements.notificationPerm.setAttribute("data-permitted", "unknown");
		elements.notificationPerm.textContent = "...";
	}

	const hasError = stateName === "error" || stateName === "warning";
	elements.clearErrors.hidden = !hasError;
	if (hasError && aggregateStatus.lastError) {
		elements.errorMessage.textContent = String(aggregateStatus.lastError);
		elements.errorMessage.hidden = false;
	} else {
		elements.errorMessage.hidden = true;
		elements.errorMessage.textContent = "";
	}
}

/** @param {string} message */
function renderError(message) {
	console.warn(LOG_PREFIX, message);
	elements.uptime.textContent = "—";
	elements.statusPill.textContent = "Error";
	elements.statusPill.className = "pill error";
	elements.errorMessage.textContent = message;
	elements.errorMessage.hidden = false;
}

/**
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
			payload,
		});
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "RUNTIME_MESSAGE_FAILED",
				message: error?.message || "Could not reach extension service worker",
			},
		};
	}
}

/** @param {number} timestamp */
function formatTimestamp(timestamp) {
	return new Intl.DateTimeFormat(undefined, {
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
	}).format(new Date(timestamp));
}

/**
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

/** @param {string} stateName */
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
