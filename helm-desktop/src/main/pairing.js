'use strict';

const crypto = require('crypto');
const QRCode = require('qrcode');
const settings = require('./settings');

/**
 * Pairing — the laptop's identity on the relay.
 *
 * A single stable session token identifies this laptop. The phone learns the token
 * (and which relay to dial) by scanning the QR; it then presents the token to the
 * relay, which pairs the two. The token is a bearer secret for the MVP — TLS via
 * the tunnel protects it in transit; rotation/revocation are roadmap.
 */

function token() {
  let t = settings.get('sessionToken');
  if (!t) { t = crypto.randomUUID(); settings.set('sessionToken', t); }
  return t;
}

/** The relay URL the desktop itself dials out to (local in dev). */
function relayUrl() {
  return settings.get('relayUrl');
}

/** The relay URL the phone should use — the tunnel URL if set, else the same one. */
function publicRelayUrl() {
  return settings.get('publicRelayUrl') || settings.get('relayUrl');
}

/** What the QR encodes: enough for the phone to reach this laptop. */
function payload() {
  return { v: 1, relay: publicRelayUrl(), token: token() };
}

async function qrDataUrl() {
  return QRCode.toDataURL(JSON.stringify(payload()), { margin: 1, width: 240 });
}

/** Everything the pairing panel needs to render. */
async function info() {
  return {
    token: token(),
    relayUrl: relayUrl(),
    publicRelayUrl: publicRelayUrl(),
    qr: await qrDataUrl()
  };
}

module.exports = { token, relayUrl, publicRelayUrl, payload, qrDataUrl, info };
