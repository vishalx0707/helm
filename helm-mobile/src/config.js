/**
 * HELM Mobile — built-in constants.
 *
 * The relay URL is a fixed constant that both apps know. The user never sees it.
 * Override via settings for local development.
 */
export const BUILTIN_RELAY_URL = 'ws://localhost:8787';

// When deployed to a hosted relay, change to:
// export const BUILTIN_RELAY_URL = 'wss://helm-relay.onrender.com';
