'use strict';

const crypto = require('crypto');
const QRCode = require('qrcode');
const settings = require('./settings');

/**
 * Pairing — the laptop's identity on the relay.
 *
 * A single stable session token identifies this laptop. The phone learns the token
 * by redeeming a short-lived 6-digit code against the relay. The desktop requests
 * codes via `pair_new`; the relay returns them via `pair_code`. The QR encodes the
 * code (not the token or relay URL — the relay address is a built-in constant on
 * both sides). The durable token is never exposed to the user.
 */

let currentCode = null;    // string, 6 digits
let codeTtl = null;        // seconds
let codeExpiresAt = null;  // epoch ms

function token() {
  let t = settings.get('sessionToken');
  if (!t) { t = crypto.randomUUID(); settings.set('sessionToken', t); }
  return t;
}

/** The relay URL the desktop itself dials out to. */
function relayUrl() {
  return settings.get('relayUrl');
}

/** The relay URL the phone should use — the tunnel URL if set, else the same one. */
function publicRelayUrl() {
  return settings.get('publicRelayUrl') || settings.get('relayUrl');
}

/** Called by relay-client when a pair_code message arrives from the relay. */
function setCode(code, ttl) {
  currentCode = code;
  codeTtl = ttl;
  codeExpiresAt = Date.now() + (ttl * 1000);
}

function getCode() {
  if (currentCode && codeExpiresAt && Date.now() >= codeExpiresAt) {
    currentCode = null;
    codeTtl = null;
    codeExpiresAt = null;
  }
  return currentCode;
}

/** What the QR encodes: just the 6-digit code. */
function payload() {
  return { v: 2, code: getCode() };
}

async function qrDataUrl() {
  const code = getCode();
  if (!code) {
    // Return a placeholder QR with instruction text
    return QRCode.toDataURL('HELM:waiting', { margin: 1, width: 240 });
  }
  return QRCode.toDataURL(JSON.stringify({ v: 2, code }), { margin: 1, width: 240 });
}

/** Everything the pairing panel needs to render. */
async function info() {
  return {
    token: token(),
    relayUrl: relayUrl(),
    publicRelayUrl: publicRelayUrl(),
    qr: await qrDataUrl(),
    code: getCode(),
    ttl: codeTtl,
    codeExpiresAt
  };
}

module.exports = { token, relayUrl, publicRelayUrl, setCode, getCode, payload, qrDataUrl, info };
