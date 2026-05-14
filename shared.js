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
    "CKA_ERROR"
  ]);
  const MESSAGE_TYPE_SET = new Set(MESSAGE_TYPES);
  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    intervalSeconds: 60,
    minIntervalSeconds: 30,
    maxIntervalSeconds: 300,
    failureWarningThreshold: 3,
    debugLogging: false
  });
  const CONNECT_ACTION_RE = /\bconnect\b/i;
  const RECONNECT_ACTION_RE = /\breconnect\b/i;
  const CONNECT_STATE_RE = /\b(disconnect|disconnected|connected|connecting|connection|connectivity)\b/i;

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
      return errorResponse("INVALID_SOURCE", "Message source is not colab-keepalive");
    }
    if (!MESSAGE_TYPE_SET.has(message.type)) {
      return errorResponse("INVALID_TYPE", "Message type is not supported");
    }
    if ("requestId" in message && typeof message.requestId !== "string") {
      return errorResponse("INVALID_REQUEST_ID", "Message requestId must be a string");
    }
    return okResponse();
  }

  /**
   * Validates settings and clamps user-editable intervals to allowed bounds.
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
      return { isConnectAction: true, action: "reconnect", label, reason: "reconnect-action" };
    }
    if (CONNECT_STATE_RE.test(label)) {
      return { isConnectAction: false, action: null, label, reason: "state-or-negative-action" };
    }
    if (CONNECT_ACTION_RE.test(label)) {
      return { isConnectAction: true, action: "connect", label, reason: "connect-action" };
    }
    return { isConnectAction: false, action: null, label, reason: "not-connect-action" };
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
   * Normalizes label-like text for action classification.
   * @param {unknown} value
   * @returns {string}
   */
  function normalizeLabel(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  globalScope.ColabKeepaliveShared = Object.freeze({
    SOURCE,
    LOG_PREFIX,
    MESSAGE_TYPES,
    DEFAULT_SETTINGS,
    classifyConnectLabel,
    createRequestId,
    errorResponse,
    okResponse,
    validateMessage,
    validateSettings
  });
})(globalThis);
