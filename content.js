"use strict";

const {
  DEFAULT_SETTINGS,
  LOG_PREFIX,
  SOURCE,
  classifyConnectLabel,
  createRequestId,
  errorResponse,
  okResponse,
  validateMessage,
  validateSettings
} = globalThis.ColabKeepaliveShared;
const MAX_SHADOW_DEPTH = 8;
const MAX_ROOTS = 80;
const MAX_TEXT_BUTTONS = 250;
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
  initialized: false
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      reportError("CONTENT_MESSAGE_ERROR", error?.message || "Unexpected content script error");
      sendResponse(errorResponse("CONTENT_MESSAGE_ERROR", error?.message || "Unexpected content script error"));
    });
  return true;
});

window.addEventListener("pagehide", cleanup, { once: true });
window.addEventListener("beforeunload", cleanup, { once: true });

void initialize();

/**
 * Initializes settings, DOM observation, interval state, and initial status.
 * @returns {Promise<void>}
 */
async function initialize() {
  state.settings = validateSettings(await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS)));
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
    case "CKA_SETTINGS_UPDATED":
    case "CKA_APPLY_SETTINGS": {
      const settings = validateSettings({ ...state.settings, ...(message.payload?.settings || {}) });
      applySettings(settings);
      await sendStatus("settings-updated");
      return okResponse(buildStatus("settings-updated"));
    }
    case "CKA_TEST_CLICK": {
      const result = await keepAliveTick({ manual: true });
      return result.ok ? okResponse(result.data) : result;
    }
    case "CKA_RECONCILE_BADGE":
    case "CKA_STATUS_UPDATE":
    case "CKA_ERROR":
      return okResponse(buildStatus("ignored"));
    default:
      return errorResponse("UNKNOWN_TYPE", `Unsupported message type: ${message.type}`);
  }
}

/**
 * Applies validated settings and starts or stops the local click interval.
 * @param {typeof DEFAULT_SETTINGS} settings
 * @returns {void}
 */
function applySettings(settings) {
  state.settings = validateSettings(settings);
  clearKeepAliveInterval();

  if (!state.settings.enabled) {
    state.nextClickAt = null;
    void sendStatus("disabled");
    return;
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

  const candidate = findConnectControl();
  if (!candidate) {
    recordFailure("NO_CONNECT_CONTROL", "No visible Connect or Reconnect control was found");
    await sendStatus("no-control");
    return errorResponse("NO_CONNECT_CONTROL", "No visible Connect or Reconnect control was found");
  }

  try {
    clickElement(candidate.element);
    state.failureCount = 0;
    state.warning = false;
    state.lastError = null;
    state.lastClickAt = Date.now();
    state.lastCandidateLabel = candidate.label;
    debugLog("Clicked control", candidate.label);
    await sendStatus(manual ? "manual-click" : "interval-click");
    return okResponse(buildStatus(manual ? "manual-click" : "interval-click"));
  } catch (error) {
    recordFailure("CLICK_FAILED", error?.message || "Could not click Connect/Reconnect control");
    await sendStatus("click-failed");
    return errorResponse("CLICK_FAILED", error?.message || "Could not click Connect/Reconnect control");
  }
}

/**
 * Finds the best visible Connect/Reconnect UI element using priority selectors.
 * @returns {{element: HTMLElement, label: string} | null}
 */
function findConnectControl() {
  const prioritySelectors = [
    { selector: "colab-connect-button", label: "colab-connect-button" },
    { selector: "#connect", label: "#connect" },
    { selector: "[aria-label*=\"Connect\" i]", label: "aria Connect" },
    { selector: "[aria-label*=\"Reconnect\" i]", label: "aria Reconnect" }
  ];

  for (const entry of prioritySelectors) {
    for (const element of queryAllDeep(entry.selector)) {
      const target = getClickableElement(element);
      if (target && isVisibleAndEnabled(target) && isConnectActionElement(target, element)) {
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
  const selectors = "button, [role=\"button\"], paper-button, mwc-button, cr-button";
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
  const nested = element.querySelector("button, [role=\"button\"], paper-button, mwc-button, cr-button");
  if (nested instanceof HTMLElement) {
    return nested;
  }
  const closest = element.closest("button, [role=\"button\"], paper-button, mwc-button, cr-button");
  return closest instanceof HTMLElement ? closest : element;
}

/**
 * Checks whether an element is likely clickable.
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isClickable(element) {
  const tagName = element.tagName.toLowerCase();
  return tagName === "button" ||
    element.getAttribute("role") === "button" ||
    tagName.endsWith("-button") ||
    typeof element.click === "function";
}

/**
 * Checks visibility and disabled state without forcing layout changes beyond bounds reads.
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isVisibleAndEnabled(element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const disabled = Boolean(element.disabled) ||
    element.getAttribute("aria-disabled") === "true" ||
    element.hasAttribute("disabled");
  return !disabled &&
    style.visibility !== "hidden" &&
    style.display !== "none" &&
    Number(style.opacity) !== 0 &&
    rect.width > 0 &&
    rect.height > 0;
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
    element.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window
    }));
  }
}

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
    attributeFilter: ["aria-label", "aria-disabled", "disabled", "style", "class"]
  });
}

/**
 * Builds a serializable tab status payload.
 * @param {string} reason
 * @returns {Record<string, unknown>}
 */
function buildStatus(reason) {
  const candidate = findConnectControl();
  return {
    state: state.warning ? "error" : state.settings.enabled ? "ready" : "disabled",
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
    updatedAt: Date.now()
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
      payload: buildStatus(reason)
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
  void chrome.runtime.sendMessage({
    source: SOURCE,
    type: "CKA_ERROR",
    requestId: createRequestId(),
    payload: { code, message, updatedAt: Date.now() }
  }).catch(() => {});
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
    element.textContent
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Clears active intervals and observers.
 * @returns {void}
 */
function cleanup() {
  clearKeepAliveInterval();
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
