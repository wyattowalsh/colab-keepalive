import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { test } from "node:test";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const ICON_SIZES = [16, 32, 48, 128, 512];
const FORBIDDEN_PERMISSIONS = new Set(["scripting", "tabs", "activeTab", "webRequest"]);

async function readText(path) {
  return await readFile(new URL(path, ROOT), "utf8");
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

async function loadShared() {
  const source = await readText("shared.js");
  const context = {
    Date,
    Math,
    Number,
    Object,
    RegExp,
    Set,
    String,
    globalThis: null
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: "shared.js" });
  return context.ColabKeepaliveShared;
}

function readPngDimensions(buffer) {
  const bytes = Buffer.from(buffer);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(bytes.subarray(12, 16).toString("ascii"), "IHDR");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

test("classifies only explicit connect and reconnect actions as clickable", async () => {
  const { classifyConnectLabel } = await loadShared();

  for (const label of ["Connect", "Reconnect", "Connect to hosted runtime", "Reconnect to runtime"]) {
    assert.equal(classifyConnectLabel(label).isConnectAction, true, label);
  }

  for (const label of ["Disconnect", "Connected", "Connected to runtime", "Connecting", "Connection details", ""]) {
    assert.equal(classifyConnectLabel(label).isConnectAction, false, label);
  }
});

test("validates and clamps persisted settings consistently", async () => {
  const { DEFAULT_SETTINGS, validateSettings } = await loadShared();

  assert.deepEqual(JSON.parse(JSON.stringify(validateSettings({}))), JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
  assert.deepEqual(JSON.parse(JSON.stringify(validateSettings({
    enabled: false,
    intervalSeconds: 999,
    minIntervalSeconds: 30,
    maxIntervalSeconds: 300,
    failureWarningThreshold: 99,
    debugLogging: true
  }))), {
    enabled: false,
    intervalSeconds: 300,
    minIntervalSeconds: 30,
    maxIntervalSeconds: 300,
    failureWarningThreshold: 20,
    debugLogging: true
  });
});

test("validates runtime message envelopes", async () => {
  const { SOURCE, validateMessage } = await loadShared();

  assert.equal(validateMessage({ source: SOURCE, type: "CKA_GET_STATUS", requestId: "abc" }).ok, true);
  assert.equal(validateMessage({ source: "wrong", type: "CKA_GET_STATUS" }).error.code, "INVALID_SOURCE");
  assert.equal(validateMessage({ source: SOURCE, type: "NOPE" }).error.code, "INVALID_TYPE");
  assert.equal(validateMessage({ source: SOURCE, type: "CKA_GET_STATUS", requestId: 123 }).error.code, "INVALID_REQUEST_ID");
});

test("manifest stays MV3, narrow, and injects content scripts on canonical Colab and subdomains", async () => {
  const manifest = await readJson("manifest.json");

  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["storage", "alarms"]);
  for (const permission of manifest.permissions) {
    assert.equal(FORBIDDEN_PERMISSIONS.has(permission), false, permission);
  }
  assert.deepEqual(manifest.host_permissions, [
    "https://colab.research.google.com/*",
    "https://*.colab.research.google.com/*"
  ]);
  assert.deepEqual(manifest.content_scripts[0].matches, [
    "https://colab.research.google.com/*",
    "https://*.colab.research.google.com/*"
  ]);
  assert.deepEqual(manifest.content_scripts[0].js, ["shared.js", "content.js"]);
  assert.equal(manifest.content_scripts[0].all_frames, false);
});

test("manifest icon paths use generated PNG files only", async () => {
  const manifest = await readJson("manifest.json");
  const iconPaths = [
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon)
  ];

  for (const iconPath of iconPaths) {
    assert.match(iconPath, /^icons\/icon-(16|32|48|128|512)\.png$/);
    assert.notEqual(iconPath, "icon.png");
  }
});

test("generated icons have expected PNG dimensions", async () => {
  for (const size of ICON_SIZES) {
    const path = `icons/icon-${size}.png`;
    const buffer = await readFile(new URL(path, ROOT));
    assert.deepEqual(readPngDimensions(buffer), [size, size], path);
  }
});

test("extension pages do not use inline handlers or remote assets", async () => {
  const html = await readText("popup/popup.html");
  assert.equal(/\son[a-z]+\s*=/.test(html), false);
  assert.equal(/<script[^>]+(?:https?:|\/\/)/i.test(html), false);
  assert.equal(/<link[^>]+href=["']https?:/i.test(html), false);
});

test("source files avoid remote calls and dynamic code execution", async () => {
  const paths = ["shared.js", "background.js", "content.js", "popup/popup.js"];
  for (const path of paths) {
    const source = await readText(path);
    assert.equal(/\beval\s*\(/.test(source), false, basename(path));
    assert.equal(/\bfetch\s*\(/.test(source), false, basename(path));
    assert.equal(/\bXMLHttpRequest\b/.test(source), false, basename(path));
  }
});
