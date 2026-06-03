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

  // --- forwarded payload (relay never inspects these) ---
  LIST: 'list', //          client -> host   {}
  CATALOG: 'catalog', //    host   -> client { projects[], agents[] }
  SUBMIT_TASK: 'submit_task', // client -> host { projectId, agentId, task }
  TASK_STARTED: 'task_started', // host -> client { taskId }
  OUTPUT: 'output', //      host   -> client { taskId, stream, chunk }
  TASK_COMPLETE: 'task_complete', // host -> client { taskId, code }
  TASK_ERROR: 'task_error', //     host -> client { taskId, message }
});

/**
 * Parse a scanned QR string into a pairing descriptor, or null if it isn't a
 * HELM pairing payload. The desktop encodes JSON: { v:1, relay, token }.
 */
export function parsePairingPayload(raw) {
  if (typeof raw !== 'string') return null;
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj.token !== 'string' || !obj.token) return null;
  if (typeof obj.relay !== 'string' || !obj.relay) return null;
  return { relay: obj.relay, token: obj.token, v: obj.v || 1 };
}
