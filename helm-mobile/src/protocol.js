/**
 * HELM wire protocol — mirror of helm-relay/protocol.js.
 *
 * One JSON message per WebSocket frame; every message has a `type`. The phone is
 * the CLIENT. It presents the pairing `token` to the relay, which pairs it with
 * the laptop (HOST) holding the same token and forwards everything else verbatim.
 *
 * Kept in sync by hand (the relay's copy is the source of truth) so all three
 * parts — relay, desktop, mobile — speak exactly the same vocabulary.
 */

export const T = Object.freeze({
  // --- relay-understood (control) ---
  HOST_HELLO: 'host_hello',
  CLIENT_HELLO: 'client_hello',
  PEER_ONLINE: 'peer_online',
  PEER_OFFLINE: 'peer_offline',
  RELAY_ERROR: 'relay_error',
  PING: 'ping',
  PONG: 'pong',

  // --- 6-digit pairing (relay-understood) ---
  PAIR_NEW: 'pair_new',
  PAIR_CODE: 'pair_code',
  PAIR_REDEEM: 'pair_redeem',
  PAIR_OK: 'pair_ok',
  PAIR_ERROR: 'pair_error',

  // --- forwarded payload (relay never inspects these) ---
  LIST: 'list', //          client -> host   {}
  CATALOG: 'catalog', //    host   -> client { projects[], agents[] }
  SUBMIT_TASK: 'submit_task', // client -> host { projectId, agentId, task }
  TASK_STARTED: 'task_started', // host -> client { taskId }
  OUTPUT: 'output', //      host   -> client { taskId, stream, chunk }
  TASK_COMPLETE: 'task_complete', // host -> client { taskId, code }
  TASK_ERROR: 'task_error', //     host -> client { taskId, message }
});

export function parsePairingPayload(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // Case 1: bare 6-digit code (from manual entry)
  if (/^\d{6}$/.test(trimmed)) {
    return { code: trimmed, v: 2 };
  }

  // Case 2: JSON payload
  let obj;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    // Case 3: URL-based QR (legacy /sim?token=... format)
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const urlObj = new URL(trimmed);
        const token = urlObj.searchParams.get('token');
        if (token) {
          const relay = trimmed.split('/sim')[0].replace(/^http(s)?:\/\//, 'ws$1://');
          return { relay, token, v: 1 };
        }
      }
    } catch (e) {
      // ignore parsing errors
    }
    return null;
  }

  // v2: { v: 2, code: "123456" }
  if (obj && obj.v === 2 && typeof obj.code === 'string' && /^\d{6}$/.test(obj.code)) {
    return { code: obj.code, v: 2 };
  }

  // v1 legacy: { v: 1, relay, token }
  if (!obj || typeof obj.token !== 'string' || !obj.token) return null;
  if (typeof obj.relay !== 'string' || !obj.relay) return null;
  return { relay: obj.relay, token: obj.token, v: obj.v || 1 };
}
