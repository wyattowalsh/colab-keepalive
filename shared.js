"use strict";

((globalScope) => {
	const SOURCE = "colab-keepalive";
	const LOG_PREFIX = "[Colab-Keepalive]";
	const MESSAGE_TYPES = Object.freeze([
		"CKA_GET_STATUS",
		"CKA_STATUS_UPDATE",
		"CKA_SETTINGS_UPDATED",
		"CKA_APPLY_SETTINGS",
		"CKA_TEST_CLICK",
		"CKA_RECONCILE_BADGE",
		"CKA_ERROR",
		"CKA_REQUEST_WAKE_LOCK",
		"CKA_RELEASE_WAKE_LOCK",
		"CKA_SHOW_NOTIFICATION",
		"CKA_DISMISS_DIALOG_DETECTED",
		"CKA_CLEAR_ERRORS",
		"CKA_EXPORT_SETTINGS",
		"CKA_IMPORT_SETTINGS",
		"CKA_GET_LIFETIME_STATS",
		"CKA_RESET_STATS",
		"CKA_NOTIFY_COORDINATED",
		"CKA_CLICK_RECORDED",
	]);
	const MESSAGE_TYPE_SET = new Set(MESSAGE_TYPES);

	const DEFAULT_WORK_DAYS = Object.freeze([1, 2, 3, 4, 5]);

	const DEFAULT_SETTINGS = Object.freeze({
		enabled: true,
		intervalSeconds: 60,
		minIntervalSeconds: 30,
		maxIntervalSeconds: 300,
		failureWarningThreshold: 3,
		debugLogging: false,
		humanizeSignals: true,
		simulateActivity: true,
		dismissDialogs: true,
		jitterRange: 0.15,
		keyboardShortcuts: true,
		browserNotifications: false,
		theme: "auto",
		humanizationPreset: "medium",
		customTheme: {},
		scheduleEnabled: false,
		workStartHour: 9,
		workEndHour: 18,
		workDays: DEFAULT_WORK_DAYS,
		activeDays: [],
		smartPause: false,
		multiTabEnabled: false,
		tabSyncMode: "independent",
		customSelectors: [],
		targetMode: "auto",
	});

	const CONNECT_ACTION_RE = /\bconnect\b/i;
	const RECONNECT_ACTION_RE = /\breconnect\b/i;
	const CONNECT_STATE_RE =
		/\b(disconnect|disconnected|connected|connecting|connection|connectivity)\b/i;

	const DISMISS_BUTTON_PATTERNS = Object.freeze([
		/\bdismiss\b/i,
		/\bgot it\b/i,
		/\bclose\b/i,
		/\bok\b/i,
		/\bokay\b/i,
		/\bconfirm\b/i,
		/\bsure\b/i,
		/\bunderstood\b/i,
		/\bcontinue\b/i,
	]);

	const SYNTHETIC_EVENT_TYPES = Object.freeze([
		"mousemove",
		"mousedown",
		"mouseup",
		"keydown",
		"keyup",
		"scroll",
		"wheel",
		"focus",
	]);

	const JITTER_MIN = 0.05;
	const JITTER_MAX = 0.35;
	const WAKE_LOCK_RETRY_MS = 30000;

	const HUMANIZATION_PRESETS = Object.freeze({
		minimal: {
			simulateActivity: false,
			dismissDialogs: false,
			jitterRange: 0.05,
			humanizeSignals: false,
		},
		low: {
			simulateActivity: true,
			dismissDialogs: false,
			jitterRange: 0.08,
			humanizeSignals: true,
		},
		medium: {
			simulateActivity: true,
			dismissDialogs: true,
			jitterRange: 0.15,
			humanizeSignals: true,
		},
		high: {
			simulateActivity: true,
			dismissDialogs: true,
			jitterRange: 0.25,
			humanizeSignals: true,
		},
		aggressive: {
			simulateActivity: true,
			dismissDialogs: true,
			jitterRange: 0.25,
			humanizeSignals: true,
		},
	});

	const TAB_SYNC_MODES = Object.freeze([
		"independent",
		"coordinated",
		"primary",
	]);
	const TARGET_MODES = Object.freeze(["auto", "custom"]);
	const DEFAULT_CUSTOM_SELECTORS = Object.freeze([
		{
			selector: "colab-connect-button",
			label: "colab-connect-button",
			enabled: true,
		},
		{ selector: "#connect", label: "#connect", enabled: true },
		{
			selector: '[aria-label*="Connect" i]',
			label: "aria Connect",
			enabled: true,
		},
		{
			selector: '[aria-label*="Reconnect" i]',
			label: "aria Reconnect",
			enabled: true,
		},
	]);
	const LIFETIME_STATS_KEYS = Object.freeze([
		"totalClicks",
		"totalFailures",
		"totalUptimeMs",
		"firstUsedAt",
		"longestSessionMs",
	]);

	/**
	 * Validates the shared runtime message envelope.
	 * @param {unknown} message
	 * @returns {{ok: boolean, data?: any, error?: {code: string, message: string}}}
	 */
	function validateMessage(message) {
		if (!message || typeof message !== "object") {
			return errorResponse("INVALID_MESSAGE", "Message must be an object");
		}
		if (message.source !== SOURCE) {
			return errorResponse(
				"INVALID_SOURCE",
				"Message source is not colab-keepalive",
			);
		}
		if (!MESSAGE_TYPE_SET.has(message.type)) {
			return errorResponse("INVALID_TYPE", "Message type is not supported");
		}
		if ("requestId" in message && typeof message.requestId !== "string") {
			return errorResponse(
				"INVALID_REQUEST_ID",
				"Message requestId must be a string",
			);
		}
		return okResponse();
	}

	/**
	 * Validates settings and clamps user-editable intervals to allowed bounds.
	 * @param {Record<string, unknown>} input
	 * @returns {typeof DEFAULT_SETTINGS}
	 */
	function validateSettings(input = {}) {
		const minIntervalSeconds = validNumber(
			input.minIntervalSeconds,
			DEFAULT_SETTINGS.minIntervalSeconds,
			5,
			3600,
		);
		const maxIntervalSeconds = Math.max(
			minIntervalSeconds,
			validNumber(
				input.maxIntervalSeconds,
				DEFAULT_SETTINGS.maxIntervalSeconds,
				minIntervalSeconds,
				3600,
			),
		);
		return {
			enabled:
				typeof input.enabled === "boolean"
					? input.enabled
					: DEFAULT_SETTINGS.enabled,
			intervalSeconds: validNumber(
				input.intervalSeconds,
				DEFAULT_SETTINGS.intervalSeconds,
				minIntervalSeconds,
				maxIntervalSeconds,
			),
			minIntervalSeconds,
			maxIntervalSeconds,
			failureWarningThreshold: validNumber(
				input.failureWarningThreshold,
				DEFAULT_SETTINGS.failureWarningThreshold,
				1,
				20,
			),
			debugLogging:
				typeof input.debugLogging === "boolean"
					? input.debugLogging
					: DEFAULT_SETTINGS.debugLogging,
			humanizeSignals:
				typeof input.humanizeSignals === "boolean"
					? input.humanizeSignals
					: DEFAULT_SETTINGS.humanizeSignals,
			simulateActivity:
				typeof input.simulateActivity === "boolean"
					? input.simulateActivity
					: DEFAULT_SETTINGS.simulateActivity,
			dismissDialogs:
				typeof input.dismissDialogs === "boolean"
					? input.dismissDialogs
					: DEFAULT_SETTINGS.dismissDialogs,
			jitterRange: validNumber(
				input.jitterRange,
				DEFAULT_SETTINGS.jitterRange,
				JITTER_MIN,
				JITTER_MAX,
			),
			keyboardShortcuts:
				typeof input.keyboardShortcuts === "boolean"
					? input.keyboardShortcuts
					: DEFAULT_SETTINGS.keyboardShortcuts,
			browserNotifications:
				typeof input.browserNotifications === "boolean"
					? input.browserNotifications
					: DEFAULT_SETTINGS.browserNotifications,
			theme: validateTheme(input.theme),
			humanizationPreset: validateHumanizationPreset(input.humanizationPreset),
			customTheme: validateCustomTheme(input.customTheme),
			scheduleEnabled:
				typeof input.scheduleEnabled === "boolean"
					? input.scheduleEnabled
					: DEFAULT_SETTINGS.scheduleEnabled,
			workStartHour: validNumber(
				input.workStartHour,
				DEFAULT_SETTINGS.workStartHour,
				0,
				23,
			),
			workEndHour: validNumber(
				input.workEndHour,
				DEFAULT_SETTINGS.workEndHour,
				0,
				23,
			),
			workDays: validateWorkDays(input.workDays),
			activeDays: Array.isArray(input.activeDays)
				? input.activeDays
						.filter((d) => typeof d === "number" && d >= 0 && d <= 6)
						.slice(0, 7)
				: [],
			smartPause:
				typeof input.smartPause === "boolean"
					? input.smartPause
					: DEFAULT_SETTINGS.smartPause,
			multiTabEnabled:
				typeof input.multiTabEnabled === "boolean"
					? input.multiTabEnabled
					: DEFAULT_SETTINGS.multiTabEnabled,
			tabSyncMode: validateTabSyncMode(input.tabSyncMode),
			customSelectors: validateCustomSelectors(input.customSelectors),
			targetMode: validateTargetMode(input.targetMode),
		};
	}

	/**
	 * Validates theme setting.
	 * @param {unknown} value
	 * @returns {"auto" | "light" | "dark"}
	 */
	function validateTheme(value) {
		if (value === "light" || value === "dark") {
			return value;
		}
		return "auto";
	}

	/**
	 * Validates humanization preset name.
	 * @param {unknown} value
	 * @returns {keyof HUMANIZATION_PRESETS}
	 */
	function validateHumanizationPreset(value) {
		if (typeof value === "string" && value in HUMANIZATION_PRESETS) {
			return value;
		}
		return "medium";
	}

	/**
	 * Merges humanization preset values into base settings.
	 * @param {typeof DEFAULT_SETTINGS} settings
	 * @returns {typeof DEFAULT_SETTINGS}
	 */
	function applyHumanizationPreset(settings, presetName) {
		const name = presetName || settings.humanizationPreset;
		const preset = HUMANIZATION_PRESETS[name];
		if (!preset) return settings;
		return { ...settings, ...preset };
	}

	/**
	 * Validates custom theme object.
	 * @param {unknown} value
	 * @returns {Record<string, string>}
	 */
	function validateCustomTheme(value) {
		if (value && typeof value === "object" && !Array.isArray(value)) {
			const theme = {};
			for (const [key, val] of Object.entries(value)) {
				if (typeof val === "string" && val.startsWith("#")) {
					theme[key] = val;
				}
			}
			return theme;
		}
		return {};
	}

	/**
	 * Validates work days array.
	 * @param {unknown} value
	 * @returns {number[]}
	 */
	function validateWorkDays(value) {
		if (Array.isArray(value)) {
			return value
				.filter((d) => typeof d === "number" && d >= 0 && d <= 6)
				.slice(0, 7);
		}
		return DEFAULT_WORK_DAYS;
	}

	/**
	 * Validates tab sync mode.
	 * @param {unknown} value
	 * @returns {string}
	 */
	function validateTabSyncMode(value) {
		if (typeof value === "string" && TAB_SYNC_MODES.includes(value)) {
			return value;
		}
		return "independent";
	}

	/**
	 * Validates custom selectors array.
	 * @param {unknown} value
	 * @returns {Array<{selector: string, label: string, enabled: boolean}>}
	 */
	function validateCustomSelectors(value) {
		if (Array.isArray(value)) {
			return value
				.filter(
					(s) => s && typeof s === "object" && typeof s.selector === "string",
				)
				.map((s) => ({
					selector: String(s.selector),
					label: typeof s.label === "string" ? s.label : String(s.selector),
					enabled: s.enabled !== false,
				}));
		}
		return [];
	}

	/**
	 * Validates target mode.
	 * @param {unknown} value
	 * @returns {string}
	 */
	function validateTargetMode(value) {
		if (typeof value === "string" && TARGET_MODES.includes(value)) {
			return value;
		}
		return "auto";
	}

	/**
	 * Classifies a visible/accessibility label as a safe Connect/Reconnect action.
	 * @param {unknown} value
	 * @returns {{isConnectAction: boolean, action: "connect" | "reconnect" | null, label: string, reason: string}}
	 */
	function classifyConnectLabel(value) {
		const label = normalizeLabel(value);
		if (!label) {
			return { isConnectAction: false, action: null, label, reason: "empty" };
		}
		if (RECONNECT_ACTION_RE.test(label)) {
			return {
				isConnectAction: true,
				action: "reconnect",
				label,
				reason: "reconnect-action",
			};
		}
		if (CONNECT_STATE_RE.test(label)) {
			return {
				isConnectAction: false,
				action: null,
				label,
				reason: "state-or-negative-action",
			};
		}
		if (CONNECT_ACTION_RE.test(label)) {
			return {
				isConnectAction: true,
				action: "connect",
				label,
				reason: "connect-action",
			};
		}
		return {
			isConnectAction: false,
			action: null,
			label,
			reason: "not-connect-action",
		};
	}

	/**
	 * Checks if a label matches a dismiss dialog button pattern.
	 * @param {unknown} value
	 * @returns {boolean}
	 */
	function isDismissLabel(value) {
		const label = normalizeLabel(value);
		if (!label) return false;
		return DISMISS_BUTTON_PATTERNS.some((re) => re.test(label));
	}

	/**
	 * Formats uptime milliseconds into a human-readable string.
	 * @param {number} ms
	 * @returns {string}
	 */
	function formatUptime(ms) {
		if (!ms || ms < 0) return "0s";
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ${hours % 24}h`;
		if (hours > 0) return `${hours}h ${minutes % 60}m`;
		if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
		return `${seconds}s`;
	}

	/**
	 * Returns a successful protocol response.
	 * @param {any} [data]
	 * @returns {{ok: true, data?: any}}
	 */
	function okResponse(data) {
		return typeof data === "undefined" ? { ok: true } : { ok: true, data };
	}

	/**
	 * Returns an error protocol response.
	 * @param {string} code
	 * @param {string} message
	 * @returns {{ok: false, error: {code: string, message: string}}}
	 */
	function errorResponse(code, message) {
		return { ok: false, error: { code, message } };
	}

	/**
	 * Creates a protocol request identifier.
	 * @returns {string}
	 */
	function createRequestId() {
		const cryptoObject = globalScope.crypto;
		return cryptoObject?.randomUUID
			? cryptoObject.randomUUID()
			: `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
	 * Creates default lifetime stats object.
	 * @returns {Record<string, number>}
	 */
	function createDefaultLifetimeStats() {
		return {
			totalClicks: 0,
			totalFailures: 0,
			totalUptimeMs: 0,
			firstUsedAt: Date.now(),
			longestSessionMs: 0,
		};
	}

	/**
	 * Formats lifetime stats for display.
	 * @param {Record<string, unknown>} stats
	 * @returns {Record<string, string>}
	 */
	function formatLifetimeStats(stats) {
		const s = stats || createDefaultLifetimeStats();
		const totalClicks = Number(s.totalClicks || 0);
		const totalFailures = Number(s.totalFailures || 0);
		const totalUptimeMs = Number(s.totalUptimeMs || 0);
		const firstUsedAt = Number(s.firstUsedAt || Date.now());
		const longestSessionMs = Number(s.longestSessionMs || 0);
		const successRate =
			totalClicks + totalFailures > 0
				? Math.round((totalClicks / (totalClicks + totalFailures)) * 100)
				: 0;
		const daysSinceFirstUse = Math.floor((Date.now() - firstUsedAt) / 86400000);
		return [
			`Clicks: ${totalClicks}`,
			`Failures: ${totalFailures}`,
			`Success: ${successRate}%`,
			`Uptime: ${formatUptime(totalUptimeMs)}`,
			`First used: ${daysSinceFirstUse > 0 ? `${daysSinceFirstUse}d ago` : "Today"}`,
			`Longest session: ${formatUptime(longestSessionMs)}`,
		].join(" | ");
	}

	/**
	 * Normalizes label-like text for action classification.
	 * @param {unknown} value
	 * @returns {string}
	 */
	function normalizeLabel(value) {
		return String(value || "")
			.replace(/\s+/g, " ")
			.trim();
	}

	globalScope.ColabKeepaliveShared = Object.freeze({
		SOURCE,
		LOG_PREFIX,
		MESSAGE_TYPES,
		DEFAULT_SETTINGS,
		DISMISS_BUTTON_PATTERNS,
		SYNTHETIC_EVENT_TYPES,
		JITTER_MIN,
		JITTER_MAX,
		WAKE_LOCK_RETRY_MS,
		HUMANIZATION_PRESETS,
		TAB_SYNC_MODES,
		TARGET_MODES,
		DEFAULT_CUSTOM_SELECTORS,
		LIFETIME_STATS_KEYS,
		classifyConnectLabel,
		isDismissLabel,
		formatUptime,
		createRequestId,
		errorResponse,
		okResponse,
		validateMessage,
		validateSettings,
		validateTheme,
		validateHumanizationPreset,
		applyHumanizationPreset,
		validateCustomTheme,
		validateWorkDays,
		validateTabSyncMode,
		validateCustomSelectors,
		validateTargetMode,
		validNumber,
		normalizeLabel,
		createDefaultLifetimeStats,
		formatLifetimeStats,
	});
})(globalThis);
