"use strict";

const {
	DEFAULT_SETTINGS,
	LOG_PREFIX,
	SOURCE,
	SYNTHETIC_EVENT_TYPES,
	applyHumanizationPreset,
	classifyConnectLabel,
	createRequestId,
	errorResponse,
	isDismissLabel,
	okResponse,
	validateMessage,
	validateSettings,
} = globalThis.ColabKeepaliveShared;

const MAX_SHADOW_DEPTH = 8;
const MAX_ROOTS = 80;
const MAX_TEXT_BUTTONS = 250;
const DISMISS_SCAN_MAX = 40;
const SYNTHETIC_EVENT_MIN_INTERVAL_MS = 8000;
const SYNTHETIC_EVENT_MAX_INTERVAL_MS = 25000;
const WAKE_LOCK_RETRY_MS = 30000;

const state = {
	settings: { ...DEFAULT_SETTINGS },
	intervalId: null,
	observer: null,
	failureCount: 0,
	lastClickAt: null,
	lastError: null,
	lastCandidateLabel: null,
	warning: false,
	nextClickAt: null,
	initialized: false,
	// Humanization state
	wakeLock: null,
	wakeLockRetryId: null,
	wakeLockRetryCount: 0,
	activityTimerId: null,
	uptimeStartAt: null,
	totalUptimeMs: 0,
	lastActivityAt: null,
	// Coordination salt for coordinated mode (per-tab random offset)
	coordSalt: Math.floor(Math.random() * 16000),
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	void handleMessage(message)
		.then(sendResponse)
		.catch((error) => {
			reportError(
				"CONTENT_MESSAGE_ERROR",
				error?.message || "Unexpected content script error",
			);
			sendResponse(
				errorResponse(
					"CONTENT_MESSAGE_ERROR",
					error?.message || "Unexpected content script error",
				),
			);
		});
	return true;
});

window.addEventListener("pagehide", cleanup, { once: true });

void initialize();

/**
 * Initializes settings, DOM observation, interval state, and initial status.
 * @returns {Promise<void>}
 */
async function initialize() {
	state.settings = applyHumanizationPreset(
		validateSettings(
			await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS)),
		),
	);
	state.initialized = true;
	setupObserver();
	applySettings(state.settings);
	await sendStatus("initialized");
}

/**
 * Handles messages sent by the extension service worker.
 * @param {unknown} message
 * @returns {Promise<{ok: boolean, data?: any, error?: {code: string, message: string}}>}
 */
async function handleMessage(message) {
	const validation = validateMessage(message);
	if (!validation.ok) {
		return validation;
	}

	switch (message.type) {
		case "CKA_GET_STATUS":
			return okResponse(buildStatus("queried"));
		case "CKA_REQUEST_WAKE_LOCK": {
			await requestWakeLock();
			return okResponse({ wakeLockActive: Boolean(state.wakeLock) });
		}
		case "CKA_RELEASE_WAKE_LOCK": {
			releaseWakeLock();
			return okResponse({ wakeLockActive: false });
		}
		case "CKA_SETTINGS_UPDATED":
		case "CKA_APPLY_SETTINGS": {
			const settings = validateSettings({
				...state.settings,
				...(message.payload?.settings || {}),
			});
			applySettings(settings);
			await sendStatus("settings-updated");
			return okResponse(buildStatus("settings-updated"));
		}
		case "CKA_TEST_CLICK": {
			const result = await keepAliveTick({ manual: true });
			return result.ok ? okResponse(result.data) : result;
		}
		case "CKA_CLEAR_ERRORS": {
			clearLocalErrors();
			return okResponse(buildStatus("cleared"));
		}
		case "CKA_RECONCILE_BADGE":
		case "CKA_STATUS_UPDATE":
		case "CKA_ERROR":
		case "CKA_SHOW_NOTIFICATION":
		case "CKA_DISMISS_DIALOG_DETECTED":
			return okResponse(buildStatus("ignored"));
		default:
			return errorResponse(
				"UNKNOWN_TYPE",
				`Unsupported message type: ${message.type}`,
			);
	}
}

/**
 * Applies validated settings and starts or stops the local click interval,
 * wake lock, and activity simulation.
 * @param {typeof DEFAULT_SETTINGS} settings
 * @returns {void}
 */
function applySettings(settings) {
	state.settings = applyHumanizationPreset(validateSettings(settings));
	clearKeepAliveInterval();
	stopActivitySimulation();
	releaseWakeLock();

	if (!state.settings.enabled) {
		state.nextClickAt = null;
		state.uptimeStartAt = null;
		void sendStatus("disabled");
		return;
	}

	// Start uptime tracking
	if (!state.uptimeStartAt) {
		state.uptimeStartAt = Date.now();
	}

	// Start wake lock
	if (state.settings.humanizeSignals) {
		void requestWakeLock();
	}

	// Start activity simulation
	if (state.settings.simulateActivity) {
		startActivitySimulation();
	}

	const intervalMs = state.settings.intervalSeconds * 1000;
	state.nextClickAt = Date.now() + intervalMs;
	state.intervalId = window.setInterval(() => {
		state.nextClickAt = Date.now() + intervalMs;
		void keepAliveTick({ manual: false });
	}, intervalMs);
}

/**
 * Performs one bounded keep-alive attempt.
 * @param {{manual: boolean}} options
 * @returns {Promise<{ok: boolean, data?: any, error?: {code: string, message: string}}>}
 */
async function keepAliveTick({ manual }) {
	if (!manual && !state.settings.enabled) {
		return okResponse(buildStatus("disabled"));
	}

	// Check schedule
	if (!manual && state.settings.scheduleEnabled && !isWithinSchedule()) {
		debugLog("Outside scheduled work hours; skipping tick");
		return okResponse(buildStatus("scheduled-pause"));
	}

	// Check multi-tab coordination
	if (!manual && state.settings.multiTabEnabled) {
		const coord = await checkMultiTabCoordination();
		if (coord.skip) {
			debugLog("Multi-tab coordination: skipping tick", coord.reason);
			return okResponse(buildStatus(coord.reason || "coordinated-pause"));
		}
		if (coord.delay && coord.delay > 0) {
			debugLog("Multi-tab coordination: delaying tick by", coord.delay, "ms");
			await new Promise((resolve) => setTimeout(resolve, coord.delay));
		}
	}

	// Check for dismiss dialogs first
	if (state.settings.dismissDialogs) {
		const dismissed = findAndClickDismissDialog();
		if (dismissed) {
			debugLog("Dismissed dialog", dismissed.label);
			await sendStatus("dismiss-dialog");
		}
	}

	const candidate = findConnectControl();
	if (!candidate) {
		recordFailure(
			"NO_CONNECT_CONTROL",
			"No visible Connect or Reconnect control was found",
		);
		await sendStatus("no-control");
		return errorResponse(
			"NO_CONNECT_CONTROL",
			"No visible Connect or Reconnect control was found",
		);
	}

	try {
		clickElement(candidate.element);
		state.failureCount = 0;
		state.warning = false;
		state.lastError = null;
		state.lastClickAt = Date.now();
		state.lastCandidateLabel = candidate.label;
		debugLog("Clicked control", candidate.label);
		await recordClickEvent("click");
		await sendStatus(manual ? "manual-click" : "interval-click");
		return okResponse(buildStatus(manual ? "manual-click" : "interval-click"));
	} catch (error) {
		recordFailure(
			"CLICK_FAILED",
			error?.message || "Could not click Connect/Reconnect control",
		);
		await recordClickEvent("failure");
		await sendStatus("click-failed");
		return errorResponse(
			"CLICK_FAILED",
			error?.message || "Could not click Connect/Reconnect control",
		);
	}
}

/**
 * Finds the best visible Connect/Reconnect UI element using priority selectors.
 * @returns {{element: HTMLElement, label: string} | null}
 */
function findConnectControl() {
	const useCustom = state.settings.targetMode === "custom";
	const customSelectors = state.settings.customSelectors || [];

	if (useCustom && customSelectors.length > 0) {
		for (const entry of customSelectors) {
			if (!entry.selector) continue;
			for (const element of queryAllDeep(entry.selector)) {
				const target = getClickableElement(element);
				if (target && isVisibleAndEnabled(target)) {
					return {
						element: target,
						label: describeElement(target, entry.label || entry.selector),
					};
				}
			}
		}
		// Fall through to defaults if no custom match
	}

	const prioritySelectors = [
		{ selector: "colab-connect-button", label: "colab-connect-button" },
		{ selector: "#connect", label: "#connect" },
		{ selector: '[aria-label*="Connect" i]', label: "aria Connect" },
		{ selector: '[aria-label*="Reconnect" i]', label: "aria Reconnect" },
	];

	for (const entry of prioritySelectors) {
		for (const element of queryAllDeep(entry.selector)) {
			const target = getClickableElement(element);
			if (
				target &&
				isVisibleAndEnabled(target) &&
				isConnectActionElement(target, element)
			) {
				return { element: target, label: describeElement(target, entry.label) };
			}
		}
	}

	for (const button of findTextButtons()) {
		if (isVisibleAndEnabled(button)) {
			return { element: button, label: describeElement(button, "text button") };
		}
	}

	return null;
}

/**
 * Finds and clicks any visible dismiss/close/continue dialog buttons.
 * @returns {{element: HTMLElement, label: string} | null}
 */
function findAndClickDismissDialog() {
	const selectors =
		'button, [role="button"], paper-button, mwc-button, cr-button, [aria-label]';
	let count = 0;
	for (const element of queryAllDeep(selectors)) {
		if (count >= DISMISS_SCAN_MAX) break;
		count++;
		if (!isVisibleAndEnabled(element)) continue;
		const label = getElementLabel(element);
		if (isDismissLabel(label)) {
			try {
				clickElement(element);
				return { element, label: describeElement(element, label) };
			} catch (error) {
				debugLog("Dismiss click failed", error?.message);
			}
		}
	}
	return null;
}

/**
 * Recursively queries document and open shadow roots with strict bounds.
 * @param {string} selector
 * @returns {HTMLElement[]}
 */
function queryAllDeep(selector) {
	const roots = collectRoots();
	const results = [];
	for (const root of roots) {
		try {
			for (const element of root.querySelectorAll(selector)) {
				if (element instanceof HTMLElement) {
					results.push(element);
				}
			}
		} catch (error) {
			debugLog("Selector failed", selector, error?.message);
		}
	}
	return results;
}

/**
 * Collects document and open shadow roots with bounded recursion.
 * @returns {(Document | ShadowRoot)[]}
 */
function collectRoots() {
	const roots = [document];
	const queue = [{ root: document, depth: 0 }];

	while (queue.length > 0 && roots.length < MAX_ROOTS) {
		const { root, depth } = queue.shift();
		if (depth >= MAX_SHADOW_DEPTH) {
			continue;
		}

		const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
		let node = treeWalker.nextNode();
		while (node && roots.length < MAX_ROOTS) {
			if (node.shadowRoot) {
				roots.push(node.shadowRoot);
				queue.push({ root: node.shadowRoot, depth: depth + 1 });
			}
			node = treeWalker.nextNode();
		}
	}

	return roots;
}

/**
 * Finds visible button-like elements containing Connect/Reconnect text.
 * @returns {HTMLElement[]}
 */
function findTextButtons() {
	const matches = [];
	const selectors =
		'button, [role="button"], paper-button, mwc-button, cr-button';
	for (const element of queryAllDeep(selectors)) {
		if (matches.length >= MAX_TEXT_BUTTONS) {
			break;
		}
		const text = getElementLabel(element);
		if (classifyConnectLabel(text).isConnectAction) {
			matches.push(element);
		}
	}
	return matches;
}

/**
 * Checks that a candidate represents a Connect/Reconnect action, not connected state.
 * @param {HTMLElement} target
 * @param {HTMLElement} sourceElement
 * @returns {boolean}
 */
function isConnectActionElement(target, sourceElement) {
	const label = getElementLabel(target) || getElementLabel(sourceElement);
	return classifyConnectLabel(label).isConnectAction;
}

/**
 * Returns the nearest clickable target for a detected UI node.
 * @param {HTMLElement} element
 * @returns {HTMLElement | null}
 */
function getClickableElement(element) {
	if (isClickable(element)) {
		return element;
	}
	const nested = element.querySelector(
		'button, [role="button"], paper-button, mwc-button, cr-button',
	);
	if (nested instanceof HTMLElement) {
		return nested;
	}
	const closest = element.closest(
		'button, [role="button"], paper-button, mwc-button, cr-button',
	);
	return closest instanceof HTMLElement ? closest : element;
}

/**
 * Checks whether an element is likely clickable.
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isClickable(element) {
	const tagName = element.tagName.toLowerCase();
	return (
		tagName === "button" ||
		element.getAttribute("role") === "button" ||
		tagName.endsWith("-button") ||
		typeof element.click === "function"
	);
}

/**
 * Checks visibility and disabled state without forcing layout changes beyond bounds reads.
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isVisibleAndEnabled(element) {
	const style = window.getComputedStyle(element);
	const rect = element.getBoundingClientRect();
	const disabled =
		Boolean(element.disabled) ||
		element.getAttribute("aria-disabled") === "true" ||
		element.hasAttribute("disabled");
	return (
		!disabled &&
		style.visibility !== "hidden" &&
		style.display !== "none" &&
		Number(style.opacity) !== 0 &&
		rect.width > 0 &&
		rect.height > 0
	);
}

/**
 * Checks whether the current time falls within the configured work schedule.
 * @returns {boolean}
 */
function isWithinSchedule() {
	const settings = state.settings;
	const now = new Date();
	const day = now.getDay();
	const hour = now.getHours();
	const workDays = settings.workDays || [];
	if (workDays.length > 0 && !workDays.includes(day)) {
		return false;
	}
	const start = settings.workStartHour ?? 0;
	const end = settings.workEndHour ?? 24;
	return hour >= start && hour < end;
}

/**
 * Checks multi-tab coordination to avoid simultaneous clicks across tabs.
 * @returns {Promise<{skip: boolean, reason?: string, delay?: number}>}
 */
async function checkMultiTabCoordination() {
	const mode = state.settings.tabSyncMode || "independent";
	if (mode === "independent") {
		return { skip: false };
	}
	if (mode === "primary") {
		try {
			const response = await chrome.runtime.sendMessage({
				source: SOURCE,
				type: "CKA_NOTIFY_COORDINATED",
				requestId: createRequestId(),
				payload: { url: location.href },
			});
			const isPrimary = response?.ok && response.data?.isPrimary;
			if (!isPrimary) {
				return { skip: true, reason: "not-primary" };
			}
			return { skip: false };
		} catch (error) {
			debugLog("Primary check failed, allowing click", error?.message);
			return { skip: false };
		}
	}
	if (mode === "coordinated") {
		// Spread clicks by hashing the URL plus a per-tab salt to a 0–15 second delay
		// Salt prevents same-URL tabs from colliding on identical delays
		let hash = 0;
		const seed = location.href + String(state.coordSalt);
		for (let i = 0; i < seed.length; i++) {
			hash = (hash << 5) - hash + seed.charCodeAt(i);
			hash |= 0;
		}
		const delay = Math.abs(hash) % 16000;
		return { skip: false, delay };
	}
	return { skip: false };
}

/**
 * Clicks an element using its normal click API, then a synthetic mouse fallback if needed.
 * @param {HTMLElement} element
 * @returns {void}
 */
function clickElement(element) {
	try {
		element.click();
		return;
	} catch (error) {
		debugLog("Native click failed, dispatching mouse fallback", error?.message);
	}
	if (typeof MouseEvent === "function") {
		element.dispatchEvent(
			new MouseEvent("click", {
				bubbles: true,
				cancelable: true,
				composed: true,
				view: window,
			}),
		);
	}
}

// ── Humanization: Screen Wake Lock ──────────────────────────────────────────

/**
 * Requests a screen wake lock to prevent the display from sleeping.
 * @returns {Promise<void>}
 */
async function requestWakeLock() {
	if (!navigator.wakeLock || state.wakeLock) {
		return;
	}
	try {
		state.wakeLock = await navigator.wakeLock.request("screen");
		state.wakeLockRetryCount = 0;
		debugLog("Screen wake lock acquired");
		state.wakeLock.addEventListener("release", () => {
			debugLog("Screen wake lock released");
			state.wakeLock = null;
			// Re-request after a short delay if still enabled (max 3 retries)
			if (
				state.settings.enabled &&
				state.settings.humanizeSignals &&
				state.wakeLockRetryCount < 3
			) {
				state.wakeLockRetryCount += 1;
				state.wakeLockRetryId = window.setTimeout(() => {
					void requestWakeLock();
				}, WAKE_LOCK_RETRY_MS);
			}
		});
	} catch (error) {
		debugLog("Screen wake lock request failed", error?.message);
	}
}

/**
 * Releases the active screen wake lock.
 * @returns {void}
 */
function releaseWakeLock() {
	if (state.wakeLockRetryId) {
		window.clearTimeout(state.wakeLockRetryId);
		state.wakeLockRetryId = null;
	}
	if (state.wakeLock) {
		try {
			state.wakeLock.release();
		} catch (error) {
			debugLog("Wake lock release failed", error?.message);
		}
		state.wakeLock = null;
	}
}

// ── Humanization: Synthetic Activity Simulation ─────────────────────────────

/**
 * Starts periodic synthetic document-level activity events with jitter.
 * @returns {void}
 */
function startActivitySimulation() {
	stopActivitySimulation();
	if (!state.settings.simulateActivity) return;

	const scheduleNext = () => {
		const baseMs =
			(SYNTHETIC_EVENT_MIN_INTERVAL_MS + SYNTHETIC_EVENT_MAX_INTERVAL_MS) / 2;
		const jitterRatio = state.settings.jitterRange || 0.15;
		const jitter = baseMs * jitterRatio;
		const delay = Math.max(
			SYNTHETIC_EVENT_MIN_INTERVAL_MS,
			Math.round(baseMs + (Math.random() * 2 - 1) * jitter),
		);
		state.activityTimerId = window.setTimeout(() => {
			dispatchSyntheticEvent();
			scheduleNext();
		}, delay);
	};

	scheduleNext();
}

/**
 * Stops the synthetic activity simulation timer.
 * @returns {void}
 */
function stopActivitySimulation() {
	if (state.activityTimerId) {
		window.clearTimeout(state.activityTimerId);
		state.activityTimerId = null;
	}
}

/**
 * Dispatches a synthetic event on document.body or window to simulate user activity.
 * @returns {void}
 */
function dispatchSyntheticEvent() {
	if (!state.settings.simulateActivity) return;

	const eventType =
		SYNTHETIC_EVENT_TYPES[
			Math.floor(Math.random() * SYNTHETIC_EVENT_TYPES.length)
		];
	const target = Math.random() > 0.3 ? document.body : window;
	if (!target) return;

	try {
		switch (eventType) {
			case "mousemove":
			case "mousedown":
			case "mouseup": {
				const x = Math.random() * window.innerWidth;
				const y = Math.random() * window.innerHeight;
				target.dispatchEvent(
					new MouseEvent(eventType, {
						bubbles: true,
						cancelable: true,
						composed: true,
						clientX: x,
						clientY: y,
						screenX: x,
						screenY: y,
						view: window,
					}),
				);
				break;
			}
			case "keydown":
			case "keyup": {
				const KEY_TO_CODE = {
					Shift: "ShiftLeft",
					Control: "ControlLeft",
					Alt: "AltLeft",
					Tab: "Tab",
					Escape: "Escape",
					Enter: "Enter",
					ArrowUp: "ArrowUp",
					ArrowDown: "ArrowDown",
					ArrowLeft: "ArrowLeft",
					ArrowRight: "ArrowRight",
				};
				const keys = Object.keys(KEY_TO_CODE);
				const key = keys[Math.floor(Math.random() * keys.length)];
				target.dispatchEvent(
					new KeyboardEvent(eventType, {
						bubbles: true,
						cancelable: true,
						composed: true,
						key,
						code: KEY_TO_CODE[key],
						view: window,
					}),
				);
				break;
			}
			case "scroll":
			case "wheel": {
				target.dispatchEvent(
					new Event(eventType, {
						bubbles: true,
						cancelable: true,
						composed: true,
					}),
				);
				break;
			}
			case "focus": {
				if (target === window && document.activeElement) {
					document.activeElement.dispatchEvent(
						new FocusEvent("focus", {
							bubbles: true,
							cancelable: true,
							composed: true,
							view: window,
						}),
					);
				}
				break;
			}
		}
		state.lastActivityAt = Date.now();
		debugLog("Synthetic event dispatched", eventType);
	} catch (error) {
		debugLog("Synthetic event failed", eventType, error?.message);
	}
}

// ── Uptime Tracking ─────────────────────────────────────────────────────────

/**
 * Returns total uptime in milliseconds.
 * @returns {number}
 */
function getUptime() {
	let uptime = state.totalUptimeMs;
	if (state.uptimeStartAt) {
		uptime += Date.now() - state.uptimeStartAt;
	}
	return uptime;
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

// ── Failure & Diagnostics ───────────────────────────────────────────────────

/**
 * Records a bounded failure and raises a warning after the configured threshold.
 * @param {string} code
 * @param {string} message
 * @returns {void}
 */
function recordFailure(code, message) {
	state.failureCount += 1;
	state.lastError = `${code}: ${message}`;
	state.warning = state.failureCount >= state.settings.failureWarningThreshold;
	debugLog("Failure", state.failureCount, state.lastError);
}

/**
 * Clears local error and warning state.
 * @returns {void}
 */
function clearLocalErrors() {
	state.failureCount = 0;
	state.lastError = null;
	state.warning = false;
	debugLog("Errors cleared");
}

/**
 * Sets up a MutationObserver so dynamic Colab UI changes are reflected in status.
 * @returns {void}
 */
function setupObserver() {
	if (state.observer) {
		state.observer.disconnect();
	}
	let debounceId = null;
	state.observer = new MutationObserver(() => {
		if (debounceId) {
			window.clearTimeout(debounceId);
		}
		debounceId = window.setTimeout(() => {
			void sendStatus("dom-changed");
		}, 500);
	});
	state.observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: [
			"aria-label",
			"aria-disabled",
			"disabled",
			"style",
			"class",
		],
	});
}

/**
 * Builds a serializable tab status payload.
 * @param {string} reason
 * @returns {Record<string, unknown>}
 */
function buildStatus(reason) {
	const candidate = findConnectControl();
	const uptime = getUptime();
	return {
		state: state.warning
			? "error"
			: state.settings.enabled
				? "ready"
				: "disabled",
		enabled: state.settings.enabled,
		intervalSeconds: state.settings.intervalSeconds,
		failureCount: state.failureCount,
		warning: state.warning,
		lastClickAt: state.lastClickAt,
		nextClickAt: state.nextClickAt,
		lastError: state.lastError,
		lastCandidateLabel: candidate?.label || state.lastCandidateLabel,
		hasVisibleControl: Boolean(candidate),
		url: location.href,
		reason,
		updatedAt: Date.now(),
		uptimeMs: uptime,
		uptimeFormatted: formatUptime(uptime),
		wakeLockActive: Boolean(state.wakeLock),
		lastActivityAt: state.lastActivityAt,
		humanizeSignals: state.settings.humanizeSignals,
		simulateActivity: state.settings.simulateActivity,
		dismissDialogs: state.settings.dismissDialogs,
	};
}

/**
 * Sends current tab status to the service worker.
 * @param {string} reason
 * @returns {Promise<void>}
 */
async function sendStatus(reason) {
	try {
		await chrome.runtime.sendMessage({
			source: SOURCE,
			type: "CKA_STATUS_UPDATE",
			requestId: createRequestId(),
			payload: buildStatus(reason),
		});
	} catch (error) {
		debugLog("Status send failed", error?.message);
	}
}

/**
 * Reports a content-script error to the service worker.
 * @param {string} code
 * @param {string} message
 * @returns {void}
 */
function reportError(code, message) {
	void chrome.runtime
		.sendMessage({
			source: SOURCE,
			type: "CKA_ERROR",
			requestId: createRequestId(),
			payload: { code, message, updatedAt: Date.now() },
		})
		.catch(() => {});
}

/**
 * Records a click event in lifetime statistics via the service worker.
 * @param {"click" | "failure"} type
 * @returns {Promise<void>}
 */
async function recordClickEvent(type) {
	try {
		const uptime = getUptime();
		await chrome.runtime.sendMessage({
			source: SOURCE,
			type: "CKA_CLICK_RECORDED",
			requestId: createRequestId(),
			payload: { type, uptimeMs: uptime },
		});
	} catch (error) {
		debugLog("Click record failed", error?.message);
	}
}

/**
 * Produces a readable element label for diagnostics.
 * @param {HTMLElement} element
 * @param {string} fallback
 * @returns {string}
 */
function describeElement(element, fallback) {
	const tag = element.tagName.toLowerCase();
	const id = element.id ? `#${element.id}` : "";
	const label = getElementLabel(element) || fallback;
	return `${tag}${id} ${label}`.trim();
}

/**
 * Extracts visible or accessible label text.
 * @param {HTMLElement} element
 * @returns {string}
 */
function getElementLabel(element) {
	return [
		element.getAttribute("aria-label"),
		element.getAttribute("title"),
		element.innerText,
		element.textContent,
	]
		.filter(Boolean)
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Clears active intervals, observers, wake lock, and activity simulation.
 * @returns {void}
 */
function cleanup() {
	clearKeepAliveInterval();
	stopActivitySimulation();
	releaseWakeLock();
	if (state.uptimeStartAt) {
		state.totalUptimeMs += Date.now() - state.uptimeStartAt;
		state.uptimeStartAt = null;
	}
	if (state.observer) {
		state.observer.disconnect();
		state.observer = null;
	}
}

/**
 * Stops the local keep-alive interval.
 * @returns {void}
 */
function clearKeepAliveInterval() {
	if (state.intervalId) {
		window.clearInterval(state.intervalId);
		state.intervalId = null;
	}
}

/**
 * Writes debug logs only when enabled.
 * @param {...unknown} args
 * @returns {void}
 */
function debugLog(...args) {
	if (state.settings.debugLogging) {
		console.debug(LOG_PREFIX, ...args);
	}
}
