"use strict";

import "./shared.js";

const {
	DEFAULT_SETTINGS,
	LOG_PREFIX,
	SOURCE,
	createRequestId,
	errorResponse,
	okResponse,
	validateMessage,
	validateSettings,
	createDefaultLifetimeStats,
	formatLifetimeStats,
} = globalThis.ColabKeepaliveShared;
const ALARM_NAME = "colab-keepalive-reconcile";
const RECONCILE_INTERVAL_MINUTES = 5;
const SESSION_STATUS_KEY = "tabStatuses";
const SESSION_UPTIME_KEY = "aggregateUptime";
const LIFETIME_STATS_KEY = "lifetimeStats";
const NOTIFICATION_ID_PREFIX = "colab-keepalive-";
const COLAB_URL_PATTERNS = [
	"https://colab.research.google.com/*",
	"https://*.colab.research.google.com/*",
];
const COLAB_ORIGINS = new Set(["https://colab.research.google.com"]);

chrome.runtime.onInstalled.addListener(() => {
	void initializeExtension();
});

chrome.runtime.onStartup.addListener(() => {
	void initializeExtension();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	void handleRuntimeMessage(message, sender)
		.then(sendResponse)
		.catch((error) => {
			console.error(LOG_PREFIX, "Unhandled message error", error);
			sendResponse(
				errorResponse("UNHANDLED_ERROR", error?.message || "Unexpected error"),
			);
		});
	return true;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
	if (areaName !== "sync") {
		return;
	}
	void handleSyncStorageChanged(changes);
});

chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name === ALARM_NAME) {
		void reconcileTabsAndBadge();
	}
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
	void handleContextMenuClick(info, tab);
});

chrome.tabs.onRemoved.addListener((tabId) => {
	void removeTabStatus(tabId);
});

chrome.commands.onCommand.addListener((command) => {
	void handleCommand(command);
});

chrome.notifications.onClicked.addListener(() => {
	void chrome.action.openPopup?.().catch(() => {});
});

/**
 * Initializes persisted defaults, badge state, and the reconciliation alarm.
 * @returns {Promise<void>}
 */
async function initializeExtension() {
	await setDefaultSettings();
	await ensureReconciliationAlarm();
	await reconcileTabsAndBadge();
	createContextMenus();
}

/**
 * Handles all extension runtime messages.
 * @param {unknown} message
 * @param {chrome.runtime.MessageSender} sender
 * @returns {Promise<{ok: boolean, data?: any, error?: {code: string, message: string}}>}
 */
async function handleRuntimeMessage(message, sender) {
	const validation = validateMessage(message);
	if (!validation.ok) {
		return validation;
	}

	const { type, payload } = message;
	const hasTabSender = Boolean(sender?.tab?.id);
	if (
		(type === "CKA_STATUS_UPDATE" || type === "CKA_ERROR") &&
		!validateSender(sender)
	) {
		return errorResponse(
			"INVALID_SENDER",
			"Rejected message from non-Colab sender",
		);
	}

	switch (type) {
		case "CKA_GET_STATUS":
			return okResponse(await getPopupStatus());
		case "CKA_STATUS_UPDATE":
			await recordTabStatus(sender.tab.id, payload);
			await updateBadge();
			return okResponse({ recorded: true });
		case "CKA_ERROR":
			await recordTabStatus(sender.tab.id, {
				state: "error",
				lastError: payload?.message || "Unknown content script error",
				updatedAt: Date.now(),
			});
			await updateBadge();
			return okResponse({ recorded: true });
		case "CKA_APPLY_SETTINGS":
			if (hasTabSender && !validateSender(sender)) {
				return errorResponse(
					"INVALID_SENDER",
					"Rejected settings request from non-Colab sender",
				);
			}
			return await applySettingsFromMessage(payload);
		case "CKA_TEST_CLICK":
			return await testClickOpenColabTab();
		case "CKA_RECONCILE_BADGE":
			await reconcileTabsAndBadge();
			return okResponse({ reconciled: true });
		case "CKA_SETTINGS_UPDATED":
			return okResponse({ accepted: true });
		case "CKA_SHOW_NOTIFICATION":
			return await showNotification(payload);
		case "CKA_DISMISS_DIALOG_DETECTED": {
			if (hasTabSender && !validateSender(sender)) {
				return errorResponse(
					"INVALID_SENDER",
					"Rejected dismiss dialog from non-Colab sender",
				);
			}
			await recordTabStatus(sender.tab.id, {
				dismissDialogDetected: true,
				dismissDialogAt: Date.now(),
				...payload,
			});
			await updateBadge();
			const settings = await getSettings();
			if (settings.browserNotifications) {
				void showNotification({
					title: "Colab Keepalive",
					message: "Dismiss dialog detected and handled automatically.",
				});
			}
			return okResponse({ recorded: true });
		}
		case "CKA_CLEAR_ERRORS": {
			if (hasTabSender) {
				await clearTabErrors(sender.tab.id);
			} else {
				await clearAllErrors();
			}
			await updateBadge();
			return okResponse({ cleared: true });
		}
		case "CKA_CLICK_RECORDED": {
			if (hasTabSender && !validateSender(sender)) {
				return errorResponse(
					"INVALID_SENDER",
					"Rejected click record from non-Colab sender",
				);
			}
			await recordClickEvent(payload);
			return okResponse({ recorded: true });
		}
		case "CKA_GET_LIFETIME_STATS": {
			const stats = await getLifetimeStats();
			return okResponse({ stats, formatted: formatLifetimeStats(stats) });
		}
		case "CKA_RESET_STATS": {
			await resetLifetimeStats();
			return okResponse({ reset: true });
		}
		case "CKA_EXPORT_SETTINGS": {
			const settings = await getSettings();
			return okResponse({ settings });
		}
		case "CKA_IMPORT_SETTINGS": {
			const imported = payload?.settings;
			if (!imported || typeof imported !== "object") {
				return errorResponse("INVALID_IMPORT", "Invalid settings object");
			}
			const validated = validateSettings(imported);
			await chrome.storage.sync.set(validated);
			await fanOutSettings(validated);
			return okResponse({ settings: validated });
		}
		case "CKA_NOTIFY_COORDINATED": {
			const url = payload?.url || sender?.tab?.url || "";
			const tabs = await queryColabTabs();
			// The primary tab is the first active tab, or the first tab overall
			const activeTabs = tabs.filter((t) => t.active);
			const primary = activeTabs[0] || tabs[0];
			const isPrimary = primary ? sender?.tab?.id === primary.id : false;
			return okResponse({
				isPrimary: Boolean(isPrimary),
				tabCount: tabs.length,
			});
		}
		default:
			return errorResponse("UNKNOWN_TYPE", `Unsupported message type: ${type}`);
	}
}

/**
 * Validates that a sender belongs to an allowed Google Colab page.
 * @param {chrome.runtime.MessageSender} sender
 * @returns {boolean}
 */
function validateSender(sender) {
	const tabUrl = sender?.tab?.url || sender?.url || "";
	if (!isAllowedColabUrl(tabUrl)) {
		return false;
	}
	if (!sender.origin) {
		return true;
	}
	try {
		const origin = new URL(sender.origin).origin;
		return (
			origin === "https://colab.research.google.com" ||
			origin.endsWith(".colab.research.google.com")
		);
	} catch {
		return false;
	}
}

/**
 * Returns validated settings from sync storage.
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
async function getSettings() {
	const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
	return validateSettings(stored);
}

/**
 * Merges defaults into sync storage without overwriting valid user settings.
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
async function setDefaultSettings() {
	const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
	const merged = validateSettings(stored);
	const needsWrite = Object.entries(merged).some(
		([key, value]) => stored[key] !== value,
	);
	if (needsWrite) {
		await chrome.storage.sync.set(merged);
	}
	return merged;
}

/**
 * Applies popup settings, persists them, and fans them out to Colab tabs.
 * @param {unknown} payload
 * @returns {Promise<{ok: boolean, data?: any, error?: {code: string, message: string}}>}
 */
async function applySettingsFromMessage(payload) {
	const nextSettings = validateSettings({
		...(await getSettings()),
		...(payload?.settings || {}),
	});
	await chrome.storage.sync.set(nextSettings);
	await fanOutSettings(nextSettings);
	await updateBadge(nextSettings);
	return okResponse({ settings: nextSettings });
}

/**
 * Handles sync storage changes by sanitizing settings and notifying open Colab tabs.
 * @param {Record<string, chrome.storage.StorageChange>} changes
 * @returns {Promise<void>}
 */
async function handleSyncStorageChanged(changes) {
	const settingChanged = Object.keys(changes).some(
		(key) => key in DEFAULT_SETTINGS,
	);
	if (!settingChanged) {
		return;
	}
	const settings = await setDefaultSettings();
	await fanOutSettings(settings);
	await updateBadge(settings);
}

/**
 * Sends updated settings to every open Colab tab.
 * @param {typeof DEFAULT_SETTINGS} settings
 * @returns {Promise<void>}
 */
async function fanOutSettings(settings) {
	const tabs = await queryColabTabs();
	await Promise.all(
		tabs.map((tab) =>
			sendToTabSafely(tab.id, {
				source: SOURCE,
				type: "CKA_SETTINGS_UPDATED",
				requestId: createRequestId(),
				payload: { settings },
			}),
		),
	);
}

/**
 * Queries open tabs that match the narrow Colab host permissions.
 * @returns {Promise<chrome.tabs.Tab[]>}
 */
async function queryColabTabs() {
	const tabSets = await Promise.all(
		COLAB_URL_PATTERNS.map((url) => chrome.tabs.query({ url })),
	);
	const seen = new Set();
	return tabSets
		.flat()
		.filter(
			(tab) =>
				typeof tab.id === "number" && !seen.has(tab.id) && seen.add(tab.id),
		);
}

/**
 * Sends a message to a tab and converts unreachable content scripts into a safe result.
 * @param {number} tabId
 * @param {Record<string, unknown>} message
 * @returns {Promise<{ok: boolean, data?: any, error?: {code: string, message: string}}>}
 */
async function sendToTabSafely(tabId, message) {
	try {
		return await chrome.tabs.sendMessage(tabId, message);
	} catch (error) {
		return errorResponse(
			"TAB_MESSAGE_FAILED",
			error?.message || "Could not message Colab tab",
		);
	}
}

/**
 * Runs one immediate click attempt in the best available Colab tab.
 * @returns {Promise<{ok: boolean, data?: any, error?: {code: string, message: string}}>}
 */
async function testClickOpenColabTab() {
	const tabs = await queryColabTabs();
	if (tabs.length === 0) {
		return errorResponse(
			"NO_COLAB_TABS",
			"No open Google Colab tabs were found",
		);
	}

	const activeTabs = tabs.filter((tab) => tab.active);
	const target = activeTabs[0] || tabs[0];
	const result = await sendToTabSafely(target.id, {
		source: SOURCE,
		type: "CKA_TEST_CLICK",
		requestId: createRequestId(),
		payload: { manual: true },
	});
	if (result?.ok) {
		await clearTabErrors(target.id);
	}
	await updateBadge();
	if (!result?.ok) {
		return result || errorResponse("TEST_CLICK_FAILED", "Test click failed");
	}
	return okResponse({ tabId: target.id, result: result.data });
}

/**
 * Records volatile tab status in session storage.
 * @param {number} tabId
 * @param {Record<string, unknown>} status
 * @returns {Promise<void>}
 */
async function recordTabStatus(tabId, status = {}) {
	const { [SESSION_STATUS_KEY]: statuses = {} } =
		await chrome.storage.session.get(SESSION_STATUS_KEY);
	statuses[String(tabId)] = {
		...(statuses[String(tabId)] || {}),
		...status,
		tabId,
		updatedAt: status.updatedAt || Date.now(),
	};
	await chrome.storage.session.set({ [SESSION_STATUS_KEY]: statuses });
}

/**
 * Removes volatile status for a closed tab.
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function removeTabStatus(tabId) {
	const { [SESSION_STATUS_KEY]: statuses = {} } =
		await chrome.storage.session.get(SESSION_STATUS_KEY);
	delete statuses[String(tabId)];
	await chrome.storage.session.set({ [SESSION_STATUS_KEY]: statuses });
	await updateBadge();
}

/**
 * Clears error and warning state for a specific tab.
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function clearTabErrors(tabId) {
	const { [SESSION_STATUS_KEY]: statuses = {} } =
		await chrome.storage.session.get(SESSION_STATUS_KEY);
	const existing = statuses[String(tabId)];
	if (!existing) return;
	delete existing.state;
	delete existing.warning;
	delete existing.lastError;
	existing.failureCount = 0;
	existing.clearedAt = Date.now();
	await chrome.storage.session.set({ [SESSION_STATUS_KEY]: statuses });
}

/**
 * Clears error and warning state for all tracked tabs.
 * @returns {Promise<void>}
 */
async function clearAllErrors() {
	const { [SESSION_STATUS_KEY]: statuses = {} } =
		await chrome.storage.session.get(SESSION_STATUS_KEY);
	for (const key of Object.keys(statuses)) {
		delete statuses[key].state;
		delete statuses[key].warning;
		delete statuses[key].lastError;
		statuses[key].failureCount = 0;
		statuses[key].clearedAt = Date.now();
	}
	await chrome.storage.session.set({ [SESSION_STATUS_KEY]: statuses });
}

/**
 * Reconciles open Colab tabs, asks content scripts for live status, and updates badges.
 * @returns {Promise<void>}
 */
async function reconcileTabsAndBadge() {
	const settings = await getSettings();
	const tabs = await queryColabTabs();
	await Promise.all(
		tabs.map(async (tab) => {
			const response = await sendToTabSafely(tab.id, {
				source: SOURCE,
				type: "CKA_GET_STATUS",
				requestId: createRequestId(),
				payload: {},
			});
			if (response?.ok && response.data) {
				await recordTabStatus(tab.id, response.data);
			}
		}),
	);
	await updateBadge(settings);
}

/**
 * Updates global and per-Colab-tab action badges.
 * @param {typeof DEFAULT_SETTINGS} [settings]
 * @returns {Promise<void>}
 */
async function updateBadge(settings) {
	const currentSettings = settings || (await getSettings());
	const tabs = await queryColabTabs();
	const { [SESSION_STATUS_KEY]: statuses = {} } =
		await chrome.storage.session.get(SESSION_STATUS_KEY);
	const hasError = Object.values(statuses).some(
		(status) => status?.state === "error" || status?.warning,
	);
	const globalState = hasError ? "ERR" : currentSettings.enabled ? "ON" : "OFF";
	await setBadgeForTab(undefined, globalState);
	await Promise.all(
		tabs.map((tab) => {
			const status = statuses[String(tab.id)];
			const state =
				status?.state === "error" || status?.warning
					? "ERR"
					: currentSettings.enabled
						? "ON"
						: "OFF";
			return setBadgeForTab(tab.id, state);
		}),
	);
}

/**
 * Sets badge text and color globally or for a specific tab.
 * @param {number | undefined} tabId
 * @param {"ON" | "OFF" | "ERR"} state
 * @returns {Promise<void>}
 */
async function setBadgeForTab(tabId, state) {
	const details = typeof tabId === "number" ? { tabId } : {};
	const color =
		state === "ON" ? "#1a7f37" : state === "ERR" ? "#d1242f" : "#6e7781";
	await chrome.action.setBadgeText({ ...details, text: state });
	await chrome.action.setBadgeBackgroundColor({ ...details, color });
}

/**
 * Builds the popup status payload.
 * @returns {Promise<Record<string, unknown>>}
 */
async function getPopupStatus() {
	const [settings, tabs, session, uptimeAggregate, notificationPermitted] =
		await Promise.all([
			getSettings(),
			queryColabTabs(),
			chrome.storage.session.get(SESSION_STATUS_KEY),
			getAggregateUptime(),
			checkNotificationPermission(),
		]);
	const statuses = session[SESSION_STATUS_KEY] || {};
	const liveStatuses = tabs.map(
		(tab) => statuses[String(tab.id)] || { tabId: tab.id, state: "unknown" },
	);
	return {
		settings,
		activeTabCount: tabs.length,
		statuses: liveStatuses,
		aggregateStatus: aggregateStatus(liveStatuses),
		uptime: uptimeAggregate,
		notificationPermitted,
		version: chrome.runtime.getManifest().version,
	};
}

/**
 * Summarizes tab states for the popup.
 * @param {Array<Record<string, unknown>>} statuses
 * @returns {Record<string, unknown>}
 */
function aggregateStatus(statuses) {
	const failureCount = statuses.reduce(
		(sum, status) => sum + Number(status.failureCount || 0),
		0,
	);
	const lastClickAt =
		statuses
			.map((status) => Number(status.lastClickAt || 0))
			.filter(Boolean)
			.sort((a, b) => b - a)[0] || null;
	const nextClickAt =
		statuses
			.map((status) => Number(status.nextClickAt || 0))
			.filter(Boolean)
			.sort((a, b) => a - b)[0] || null;
	const totalUptimeMs = statuses.reduce(
		(sum, status) => sum + Number(status.uptimeMs || 0),
		0,
	);
	const wakeLockActive = statuses.some((status) => status.wakeLockActive);
	const humanizeActive = statuses.some(
		(status) => status.humanizeSignals || status.simulateActivity,
	);
	const dismissDialogDetected = statuses.some(
		(status) => status.dismissDialogDetected,
	);
	const state = statuses.some((status) => status.state === "error")
		? "error"
		: statuses.some((status) => status.warning)
			? "warning"
			: statuses.length > 0
				? "ready"
				: "no-tabs";
	const lastError =
		statuses.find((status) => status.lastError)?.lastError || null;
	return {
		state,
		failureCount,
		lastClickAt,
		nextClickAt,
		lastError,
		totalUptimeMs,
		totalUptimeFormatted:
			globalThis.ColabKeepaliveShared.formatUptime(totalUptimeMs),
		wakeLockActive,
		humanizeActive,
		dismissDialogDetected,
	};
}

/**
 * Ensures the periodic reconciliation alarm exists.
 * @returns {Promise<void>}
 */
async function ensureReconciliationAlarm() {
	const alarm = await chrome.alarms.get(ALARM_NAME);
	if (!alarm) {
		await chrome.alarms.create(ALARM_NAME, {
			periodInMinutes: RECONCILE_INTERVAL_MINUTES,
		});
	}
}

// ── Context Menu ────────────────────────────────────────────────────────────

/**
 * Creates the extension context menu items.
 * @returns {void}
 */
function createContextMenus() {
	chrome.contextMenus.removeAll(() => {
		chrome.contextMenus.create({
			id: "cka-toggle",
			title: "Toggle Keepalive",
			contexts: ["page", "action"],
			documentUrlPatterns: COLAB_URL_PATTERNS,
		});
		chrome.contextMenus.create({
			id: "cka-click-now",
			title: "Click Now",
			contexts: ["page", "action"],
			documentUrlPatterns: COLAB_URL_PATTERNS,
		});
		chrome.contextMenus.create({
			id: "cka-separator-1",
			type: "separator",
			contexts: ["page", "action"],
			documentUrlPatterns: COLAB_URL_PATTERNS,
		});
		chrome.contextMenus.create({
			id: "cka-open-settings",
			title: "Open Settings",
			contexts: ["page", "action"],
			documentUrlPatterns: COLAB_URL_PATTERNS,
		});
	});
}

/**
 * Handles context menu clicks.
 * @param {chrome.contextMenus.OnClickData} info
 * @param {chrome.tabs.Tab | undefined} tab
 * @returns {Promise<void>}
 */
async function handleContextMenuClick(info, tab) {
	const settings = await getSettings();
	switch (info.menuItemId) {
		case "cka-toggle": {
			const next = { enabled: !settings.enabled };
			await chrome.storage.sync.set(next);
			await fanOutSettings({ ...settings, ...next });
			await updateBadge({ ...settings, ...next });
			break;
		}
		case "cka-click-now": {
			if (tab?.id) {
				const response = await sendToTabSafely(tab.id, {
					source: SOURCE,
					type: "CKA_TEST_CLICK",
					requestId: createRequestId(),
					payload: {},
				});
				if (!response?.ok) {
					console.warn(
						LOG_PREFIX,
						"Context-menu click failed",
						response?.error,
					);
				}
			}
			break;
		}
		case "cka-open-settings": {
			void chrome.runtime.openOptionsPage?.() || chrome.action.openPopup?.();
			break;
		}
	}
}

/**
 * Handles keyboard shortcuts triggered via chrome.commands.
 * @param {string} command
 * @returns {Promise<void>}
 */
async function handleCommand(command) {
	const settings = await getSettings();
	switch (command) {
		case "toggle-enabled": {
			const next = { enabled: !settings.enabled };
			await chrome.storage.sync.set(next);
			await fanOutSettings({ ...settings, ...next });
			await updateBadge({ ...settings, ...next });
			void showNotification({
				title: "Colab Keepalive",
				message: next.enabled ? "Extension enabled" : "Extension disabled",
			});
			break;
		}
		case "trigger-click": {
			const result = await testClickOpenColabTab();
			if (!result.ok) {
				void showNotification({
					title: "Colab Keepalive",
					message: `Click failed: ${result.error?.message || "Unknown error"}`,
				});
			}
			break;
		}
		case "toggle-humanize": {
			const next = { humanizeSignals: !settings.humanizeSignals };
			await chrome.storage.sync.set(next);
			await fanOutSettings({ ...settings, ...next });
			void showNotification({
				title: "Colab Keepalive",
				message: next.humanizeSignals
					? "Humanization enabled"
					: "Humanization disabled",
			});
			break;
		}
	}
}

/**
 * Shows a browser notification if permission is granted.
 * @param {{title: string, message: string, iconUrl?: string}} options
 * @returns {Promise<{ok: boolean, data?: any, error?: {code: string, message: string}}>}
 */
async function showNotification(options) {
	const permitted = await checkNotificationPermission();
	if (!permitted) {
		return errorResponse(
			"NOTIFICATIONS_BLOCKED",
			"Browser notifications are not permitted",
		);
	}
	try {
		const id = `${NOTIFICATION_ID_PREFIX}${Date.now()}`;
		await chrome.notifications.create(id, {
			type: "basic",
			iconUrl: options.iconUrl || chrome.runtime.getURL("icons/icon-128.png"),
			title: options.title || "Colab Keepalive",
			message: options.message || "",
			priority: 1,
		});
		return okResponse({ id });
	} catch (error) {
		return errorResponse(
			"NOTIFICATION_FAILED",
			error?.message || "Failed to show notification",
		);
	}
}

/**
 * Checks whether browser notifications are permitted.
 * @returns {Promise<boolean>}
 */
async function checkNotificationPermission() {
	try {
		if (chrome.notifications?.getPermissionLevel) {
			const level = await chrome.notifications.getPermissionLevel();
			return level === "granted";
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Aggregates total uptime across all tracked Colab tabs.
 * @returns {Promise<{totalUptimeMs: number, totalUptimeFormatted: string, tabCount: number}>}
 */
async function getAggregateUptime() {
	const { [SESSION_STATUS_KEY]: statuses = {} } =
		await chrome.storage.session.get(SESSION_STATUS_KEY);
	const tabs = await queryColabTabs();
	let totalMs = 0;
	const seen = new Set();
	for (const status of Object.values(statuses)) {
		if (status?.uptimeMs && typeof status.uptimeMs === "number") {
			totalMs += status.uptimeMs;
			seen.add(String(status.tabId));
		}
	}
	const { [SESSION_UPTIME_KEY]: persisted = {} } =
		await chrome.storage.session.get(SESSION_UPTIME_KEY);
	totalMs += persisted.totalUptimeMs || 0;
	const tabCount = tabs.length;
	return {
		totalUptimeMs: totalMs,
		totalUptimeFormatted: globalThis.ColabKeepaliveShared.formatUptime(totalMs),
		tabCount,
	};
}

// ── Lifetime Statistics ────────────────────────────────────────────────────

/**
 * Records a click event in lifetime statistics.
 * @param {{type: string, uptimeMs?: number}} [payload]
 * @returns {Promise<void>}
 */
async function recordClickEvent(payload = {}) {
	const { [LIFETIME_STATS_KEY]: existing = {} } =
		await chrome.storage.local.get(LIFETIME_STATS_KEY);
	const stats = { ...createDefaultLifetimeStats(), ...existing };
	if (payload.type === "click") {
		stats.totalClicks = (stats.totalClicks || 0) + 1;
	} else if (payload.type === "failure") {
		stats.totalFailures = (stats.totalFailures || 0) + 1;
	}
	if (payload.uptimeMs && payload.uptimeMs > 0) {
		stats.totalUptimeMs = (stats.totalUptimeMs || 0) + payload.uptimeMs;
		const currentLongest = stats.longestSessionMs || 0;
		if (payload.uptimeMs > currentLongest) {
			stats.longestSessionMs = payload.uptimeMs;
		}
	}
	await chrome.storage.local.set({ [LIFETIME_STATS_KEY]: stats });
}

/**
 * Returns lifetime statistics from local storage.
 * @returns {Promise<Record<string, number>>}
 */
async function getLifetimeStats() {
	const { [LIFETIME_STATS_KEY]: stats } =
		await chrome.storage.local.get(LIFETIME_STATS_KEY);
	return { ...createDefaultLifetimeStats(), ...stats };
}

/**
 * Resets lifetime statistics to defaults.
 * @returns {Promise<void>}
 */
async function resetLifetimeStats() {
	await chrome.storage.local.set({
		[LIFETIME_STATS_KEY]: createDefaultLifetimeStats(),
	});
}

/**
 * Checks whether a URL belongs to the allowed Colab origin set.
 * @param {string} value
 * @returns {boolean}
 */
function isAllowedColabUrl(value) {
	try {
		const url = new URL(value);
		return (
			url.protocol === "https:" &&
			(COLAB_ORIGINS.has(url.origin) ||
				url.hostname.endsWith(".colab.research.google.com"))
		);
	} catch {
		return false;
	}
}
