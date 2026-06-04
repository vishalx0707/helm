'use strict';

/**
 * HELM wire protocol — shared message contract.
 *
 * One JSON message per WebSocket frame. Every message has a `type`. The relay
 * pairs a HOST (laptop) and a CLIENT (phone/sim) that present the same `token`,
 * then forwards every other message between them verbatim. The relay itself
 * understands ONLY the hello/keepalive/peer-status types below — everything else
 * is opaque payload it routes without inspecting.
 *
 * This file is intentionally dependency-free and copy-shared by helm-desktop and
 * helm-mobile so all three parts speak exactly the same vocabulary.
 */

const RELAY_PORT = 8787; // fixed dev port; the tunnel terminates TLS in front of it

const T = Object.freeze({
  // --- relay-understood (control) ---
  HOST_HELLO:   'host_hello',    // host   -> relay  { token }
  CLIENT_HELLO: 'client_hello',  // client -> relay  { token }
  PEER_ONLINE:  'peer_online',   // relay  -> peer   {}
  PEER_OFFLINE: 'peer_offline',  // relay  -> peer   {}
  RELAY_ERROR:  'relay_error',   // relay  -> sender { message }
  PING:         'ping',
  PONG:         'pong',

  // --- 6-digit pairing (relay-understood) ---
  PAIR_NEW:     'pair_new',      // host   -> relay  {}
  PAIR_CODE:    'pair_code',     // relay  -> host   { code, ttl }
  PAIR_REDEEM:  'pair_redeem',   // client -> relay  { code }
  PAIR_OK:      'pair_ok',       // relay  -> client { token }
  PAIR_ERROR:   'pair_error',    // relay  -> client { message }

  // --- forwarded payload (relay never inspects these) ---
  LIST:           'list',          // client -> host   {}
  CATALOG:        'catalog',       // host   -> client { projects[], agents[] }
  SUBMIT_TASK:    'submit_task',   // client -> host   { projectId, agentId, task }
  TASK_STARTED:   'task_started',  // host   -> client { taskId }
  OUTPUT:         'output',        // host   -> client { taskId, stream, chunk }
  TASK_COMPLETE:  'task_complete', // host   -> client { taskId, code }
  TASK_ERROR:     'task_error'     // host   -> client { taskId, message }
});

// The set the relay handles directly; anything else gets forwarded to the peer.
// PEER_ONLINE, PEER_OFFLINE, and RELAY_ERROR are relay-generated — they must
// never be forwarded from a peer, otherwise one side could spoof control messages.
const RELAY_CONTROL = new Set([
  T.HOST_HELLO, T.CLIENT_HELLO, T.PING, T.PONG,
  T.PEER_ONLINE, T.PEER_OFFLINE, T.RELAY_ERROR,
  T.PAIR_NEW, T.PAIR_CODE, T.PAIR_REDEEM, T.PAIR_OK, T.PAIR_ERROR
]);

module.exports = { RELAY_PORT, T, RELAY_CONTROL };
