"use strict";

const {
	DEFAULT_SETTINGS,
	JITTER_MIN,
	JITTER_MAX,
	LOG_PREFIX,
	SOURCE,
	createRequestId,
	validateSettings,
	formatUptime,
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
	nextClick: document.getElementById("next-click"),
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
	humanizationPreset: document.getElementById("humanization-preset"),
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
	totalClicks: document.getElementById("total-clicks"),
	successRate: document.getElementById("success-rate"),
	totalUptime: document.getElementById("total-uptime"),
	longestSession: document.getElementById("longest-session"),
	firstUsed: document.getElementById("first-used"),
	resetStats: document.getElementById("reset-stats"),
	copyJson: document.getElementById("copy-json"),
	pasteJson: document.getElementById("paste-json"),
	tabDashboard: document.getElementById("tab-dashboard"),
	tabSettings: document.getElementById("tab-settings"),
	tabAdvanced: document.getElementById("tab-advanced"),
	panelDashboard: document.getElementById("panel-dashboard"),
	panelSettings: document.getElementById("panel-settings"),
	panelAdvanced: document.getElementById("panel-advanced"),
	scheduleEnabled: document.getElementById("schedule-enabled"),
	scheduleControls: document.getElementById("schedule-controls"),
	workStart: document.getElementById("work-start"),
	workEnd: document.getElementById("work-end"),
	workDays: document.querySelectorAll('.work-days input[type="checkbox"]'),
	multiTabEnabled: document.getElementById("multi-tab-enabled"),
	multitabControls: document.getElementById("multitab-controls"),
	tabSyncMode: document.getElementById("tab-sync-mode"),
	targetMode: document.getElementById("target-mode"),
	customSelectors: document.getElementById("custom-selectors"),
	themeAccent: document.getElementById("theme-accent"),
	themeBg: document.getElementById("theme-bg"),
	themeFg: document.getElementById("theme-fg"),
	resetTheme: document.getElementById("reset-theme"),
};

const state = {
	settings: { ...DEFAULT_SETTINGS },
	saveTimer: null,
	isSaving: false,
	isDirty: false,
	activeTabCount: 0,
	countdownTimer: null,
	nextClickAt: null,
};

const THEME_CYCLE = ["auto", "light", "dark"];

const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");

/** @returns {void} */
function applyTheme(theme) {
	const html = document.documentElement;
	if (theme === "light") {
		html.setAttribute("data-theme", "light");
	} else if (theme === "dark") {
		html.setAttribute("data-theme", "dark");
	} else {
		// Auto: follow system preference
		if (darkModeQuery.matches) {
			html.setAttribute("data-theme", "dark");
		} else {
			html.removeAttribute("data-theme");
		}
	}
}

/** @returns {void} */
function setupThemeListener() {
	darkModeQuery.addEventListener("change", () => {
		if (state.settings.theme === "auto") {
			applyTheme("auto");
		}
	});
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

/**
 * Applies custom theme colors as CSS custom properties.
 * @param {Record<string, string>} customTheme
 * @returns {void}
 */
function applyCustomTheme(customTheme) {
	const html = document.documentElement;
	if (customTheme?.accent) {
		html.style.setProperty("--accent", customTheme.accent);
		html.style.setProperty("--accent-strong", customTheme.accent);
	} else {
		html.style.removeProperty("--accent");
		html.style.removeProperty("--accent-strong");
	}
	if (customTheme?.bg) {
		html.style.setProperty("--bg", customTheme.bg);
	} else {
		html.style.removeProperty("--bg");
	}
	if (customTheme?.fg) {
		html.style.setProperty("--fg", customTheme.fg);
	} else {
		html.style.removeProperty("--fg");
	}
}

document.addEventListener("DOMContentLoaded", () => {
	wireEvents();
	setupThemeListener();
	void refreshStatus();
	window.setInterval(() => void refreshStatus(), 2000);
	state.countdownTimer = window.setInterval(updateCountdown, 1000);
});

/** @returns {void} */
function wireEvents() {
	elements.enabled.addEventListener("change", () => {
		state.settings.enabled = elements.enabled.checked;
		markDirty();
	});

	elements.interval.addEventListener("input", () =>
		syncIntervalInputs(elements.interval.value),
	);
	elements.intervalNumber.addEventListener("input", () =>
		syncIntervalInputs(elements.intervalNumber.value),
	);
	elements.intervalNumber.addEventListener("change", () => {
		syncIntervalInputs(elements.intervalNumber.value);
		markDirty();
	});

	elements.jitter.addEventListener("input", () =>
		syncJitterInputs(elements.jitter.value),
	);
	elements.jitterNumber.addEventListener("input", () =>
		syncJitterInputs(elements.jitterNumber.value),
	);
	elements.jitterNumber.addEventListener("change", () => {
		syncJitterInputs(elements.jitterNumber.value);
		markDirty();
	});

	elements.humanizeSignals.addEventListener("change", () => {
		state.settings.humanizeSignals = elements.humanizeSignals.checked;
		markDirty();
	});
	elements.simulateActivity.addEventListener("change", () => {
		state.settings.simulateActivity = elements.simulateActivity.checked;
		markDirty();
	});
	elements.dismissDialogs.addEventListener("change", () => {
		state.settings.dismissDialogs = elements.dismissDialogs.checked;
		markDirty();
	});
	elements.browserNotifications.addEventListener("change", () => {
		state.settings.browserNotifications = elements.browserNotifications.checked;
		markDirty();
	});
	elements.keyboardShortcuts.addEventListener("change", () => {
		state.settings.keyboardShortcuts = elements.keyboardShortcuts.checked;
		markDirty();
	});

	elements.humanizationPreset.addEventListener("change", () => {
		state.settings.humanizationPreset = elements.humanizationPreset.value;
		markDirty();
	});

	elements.themeToggle.addEventListener("click", () => {
		const next = nextTheme(state.settings.theme);
		state.settings.theme = next;
		applyTheme(next);
		elements.themeToggle.textContent = themeIcon(next);
		markDirty();
	});

	elements.save.addEventListener("click", () => void saveSettingsNow());
	elements.reset.addEventListener("click", () => {
		state.settings = { ...DEFAULT_SETTINGS };
		applySettingsToUi(DEFAULT_SETTINGS);
		markDirty();
	});
	elements.testClick.addEventListener("click", () => void testClickNow());
	elements.clearErrors.addEventListener("click", () => void clearErrorsNow());
	elements.resetStats.addEventListener("click", () => void resetStatsNow());
	elements.copyJson.addEventListener("click", () => void copyJsonToClipboard());
	elements.pasteJson.addEventListener(
		"click",
		() => void pasteJsonFromClipboard(),
	);

	elements.scheduleEnabled.addEventListener("change", () => {
		state.settings.scheduleEnabled = elements.scheduleEnabled.checked;
		elements.scheduleControls.classList.toggle(
			"disabled",
			!elements.scheduleEnabled.checked,
		);
		markDirty();
	});
	elements.workStart.addEventListener("change", () => {
		state.settings.workStartHour = clampHour(elements.workStart.value);
		markDirty();
	});
	elements.workEnd.addEventListener("change", () => {
		state.settings.workEndHour = clampHour(elements.workEnd.value);
		markDirty();
	});
	for (const cb of elements.workDays) {
		cb.addEventListener("change", () => {
			state.settings.workDays = Array.from(elements.workDays)
				.filter((c) => c.checked)
				.map((c) => Number(c.value));
			markDirty();
		});
	}

	elements.multiTabEnabled.addEventListener("change", () => {
		state.settings.multiTabEnabled = elements.multiTabEnabled.checked;
		elements.multitabControls.classList.toggle(
			"disabled",
			!elements.multiTabEnabled.checked,
		);
		markDirty();
	});
	elements.tabSyncMode.addEventListener("change", () => {
		state.settings.tabSyncMode = elements.tabSyncMode.value;
		markDirty();
	});
	elements.targetMode.addEventListener("change", () => {
		state.settings.targetMode = elements.targetMode.checked ? "custom" : "auto";
		elements.customSelectors.classList.toggle(
			"disabled",
			!elements.targetMode.checked,
		);
		markDirty();
	});

	elements.themeAccent.addEventListener("input", () => {
		state.settings.customTheme = state.settings.customTheme || {};
		state.settings.customTheme.accent = elements.themeAccent.value;
		applyCustomTheme(state.settings.customTheme);
		markDirty();
	});
	elements.themeBg.addEventListener("input", () => {
		state.settings.customTheme = state.settings.customTheme || {};
		state.settings.customTheme.bg = elements.themeBg.value;
		applyCustomTheme(state.settings.customTheme);
		markDirty();
	});
	elements.themeFg.addEventListener("input", () => {
		state.settings.customTheme = state.settings.customTheme || {};
		state.settings.customTheme.fg = elements.themeFg.value;
		applyCustomTheme(state.settings.customTheme);
		markDirty();
	});
	elements.resetTheme.addEventListener("click", () => {
		state.settings.customTheme = {};
		applyCustomTheme({});
		applySettingsToUi(state.settings);
		markDirty();
	});

	elements.tabDashboard.addEventListener("click", () => switchTab("dashboard"));
	elements.tabSettings.addEventListener("click", () => switchTab("settings"));
	elements.tabAdvanced.addEventListener("click", () => switchTab("advanced"));
}

/** @param {"dashboard" | "settings" | "advanced"} tab */
function switchTab(tab) {
	const tabs = {
		dashboard: { btn: elements.tabDashboard, panel: elements.panelDashboard },
		settings: { btn: elements.tabSettings, panel: elements.panelSettings },
		advanced: { btn: elements.tabAdvanced, panel: elements.panelAdvanced },
	};
	for (const { btn, panel } of Object.values(tabs)) {
		btn.classList.remove("active");
		btn.setAttribute("aria-selected", "false");
		panel.classList.remove("active");
		panel.hidden = true;
	}
	const active = tabs[tab];
	if (active) {
		active.btn.classList.add("active");
		active.btn.setAttribute("aria-selected", "true");
		active.panel.classList.add("active");
		active.panel.hidden = false;
	}
}

/** @returns {Promise<void>} */
async function resetStatsNow() {
	elements.resetStats.disabled = true;
	elements.resetStats.textContent = "...";
	const response = await sendRuntimeMessage("CKA_RESET_STATS", {});
	if (!response.ok) {
		renderError(response.error?.message || "Could not reset stats");
	} else {
		elements.saveState.textContent = "Stats reset";
	}
	await fetchLifetimeStats();
	elements.resetStats.textContent = "↺";
	elements.resetStats.disabled = false;
}

/** @returns {Promise<void>} */
async function fetchLifetimeStats() {
	const response = await sendRuntimeMessage("CKA_GET_LIFETIME_STATS", {});
	if (!response.ok) {
		console.warn(
			LOG_PREFIX,
			"Could not fetch lifetime stats:",
			response.error?.message,
		);
		return;
	}
	const stats = response.data?.stats || {};
	elements.totalClicks.textContent = String(stats.totalClicks || 0);
	const totalAttempts = (stats.totalClicks || 0) + (stats.totalFailures || 0);
	const rate =
		totalAttempts > 0
			? Math.round(((stats.totalClicks || 0) / totalAttempts) * 100)
			: 0;
	elements.successRate.textContent = `${rate}%`;
	elements.totalUptime.textContent = formatUptime(stats.totalUptimeMs || 0);
	elements.longestSession.textContent = formatUptime(
		stats.longestSessionMs || 0,
	);
	elements.firstUsed.textContent = stats.firstUsedAt
		? new Intl.DateTimeFormat(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
			}).format(new Date(stats.firstUsedAt))
		: "Today";
}

/** @returns {Promise<void>} */
async function copyJsonToClipboard() {
	elements.copyJson.disabled = true;
	elements.copyJson.textContent = "Copying...";
	try {
		const response = await sendRuntimeMessage("CKA_EXPORT_SETTINGS", {});
		if (!response.ok) {
			renderError(response.error?.message || "Could not export settings");
			return;
		}
		const json = JSON.stringify(response.data.settings, null, 2);
		await navigator.clipboard.writeText(json);
		elements.saveState.textContent = "Copied";
	} catch (error) {
		renderError(error?.message || "Copy failed");
	} finally {
		elements.copyJson.textContent = "Copy JSON";
		elements.copyJson.disabled = false;
	}
}

/** @returns {Promise<void>} */
async function pasteJsonFromClipboard() {
	elements.pasteJson.disabled = true;
	elements.pasteJson.textContent = "Pasting...";
	try {
		const json = await navigator.clipboard.readText();
		if (!json || !json.trim()) {
			renderError("Clipboard is empty");
			return;
		}
		const parsed = JSON.parse(json);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			renderError("Clipboard does not contain valid settings JSON");
			return;
		}
		// Strict validation: reject if any top-level key is not a known setting
		const knownKeys = Object.keys(validateSettings({}));
		const unknownKeys = Object.keys(parsed).filter(
			(k) => !knownKeys.includes(k),
		);
		if (unknownKeys.length > 0) {
			renderError(`Unknown settings keys: ${unknownKeys.join(", ")}`);
			return;
		}
		const validated = validateSettings(parsed);
		const response = await sendRuntimeMessage("CKA_IMPORT_SETTINGS", {
			settings: validated,
		});
		if (!response.ok) {
			renderError(response.error?.message || "Could not import settings");
		} else {
			state.settings = validateSettings(response.data.settings);
			applySettingsToUi(state.settings);
			elements.saveState.textContent = "Pasted";
		}
	} catch (error) {
		renderError(error?.message || "Paste failed");
	} finally {
		elements.pasteJson.textContent = "Paste JSON";
		elements.pasteJson.disabled = false;
	}
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

	if (!state.isDirty) {
		state.settings = validateSettings(settings);
		applySettingsToUi(state.settings);
	}
	state.activeTabCount = Number(activeTabCount || 0);
	elements.version.textContent =
		version || chrome.runtime.getManifest().version;
	renderStatus(activeTabCount, aggregateStatus, uptime, notificationPermitted);
	await fetchLifetimeStats();
}

/** @returns {Promise<void>} */
async function saveSettingsNow() {
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
	clearDirty();
	elements.saveState.textContent = "Saved";
	await refreshStatus();
}

/** @returns {void} */
function markDirty() {
	state.isDirty = true;
	elements.saveState.textContent = "Unsaved";
	elements.save.disabled = false;
}

/** @returns {void} */
function clearDirty() {
	state.isDirty = false;
	elements.save.disabled = true;
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
function syncIntervalInputs(rawValue, forceClamp = false) {
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
}

/**
 * @param {string | number} rawValue
 * @param {boolean} [forceClamp]
 * @returns {void}
 */
function syncJitterInputs(rawValue, forceClamp = false) {
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
}

/**
 * @param {typeof DEFAULT_SETTINGS} settings
 * @returns {void}
 */
/** @param {string | number} value */
function clampHour(value) {
	const n = Number(value);
	if (!Number.isFinite(n)) return 0;
	return Math.min(23, Math.max(0, Math.round(n)));
}

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

	elements.humanizationPreset.value =
		settings.humanizationPreset || DEFAULT_SETTINGS.humanizationPreset;
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

	elements.scheduleEnabled.checked = Boolean(settings.scheduleEnabled);
	elements.scheduleControls.classList.toggle(
		"disabled",
		!settings.scheduleEnabled,
	);
	elements.workStart.value = String(settings.workStartHour ?? 9);
	elements.workEnd.value = String(settings.workEndHour ?? 18);
	const workDays = new Set(settings.workDays || []);
	for (const cb of elements.workDays) {
		cb.checked = workDays.has(Number(cb.value));
	}

	elements.multiTabEnabled.checked = Boolean(settings.multiTabEnabled);
	elements.multitabControls.classList.toggle(
		"disabled",
		!settings.multiTabEnabled,
	);
	elements.tabSyncMode.value =
		settings.tabSyncMode || DEFAULT_SETTINGS.tabSyncMode;

	elements.targetMode.checked = settings.targetMode === "custom";
	elements.customSelectors.classList.toggle(
		"disabled",
		settings.targetMode !== "custom",
	);

	const customTheme = settings.customTheme || {};
	elements.themeAccent.value = customTheme.accent || "";
	elements.themeBg.value = customTheme.bg || "";
	elements.themeFg.value = customTheme.fg || "";
	applyCustomTheme(customTheme);
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

	// Update countdown target
	state.nextClickAt = aggregateStatus.nextClickAt
		? Number(aggregateStatus.nextClickAt)
		: null;
	updateCountdown();
}

/**
 * Updates the next-click countdown display.
 * @returns {void}
 */
function updateCountdown() {
	if (!state.nextClickAt) {
		elements.nextClick.textContent = "—";
		return;
	}
	const remaining = state.nextClickAt - Date.now();
	if (remaining <= 0) {
		elements.nextClick.textContent = "Now";
		return;
	}
	const seconds = Math.floor(remaining / 1000) % 60;
	const minutes = Math.floor(remaining / 60000) % 60;
	const hours = Math.floor(remaining / 3600000);
	if (hours > 0) {
		elements.nextClick.textContent = `${hours}h ${minutes}m`;
	} else if (minutes > 0) {
		elements.nextClick.textContent = `${minutes}m ${seconds}s`;
	} else {
		elements.nextClick.textContent = `${seconds}s`;
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
