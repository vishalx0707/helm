'use strict';

const { randomInt } = require('crypto');

/**
 * Pairing codes — the one small piece of state the otherwise-dumb relay keeps.
 *
 * The relay is public: anyone on the internet can open a socket to it. A 6-digit
 * code can't carry a 128-bit key, so the relay resolves a short-lived, one-time
 * code to the laptop's durable session token. Codes live only in memory: nothing
 * is persisted, and they vanish on restart.
 *
 * Security model for the 1,000,000-code space:
 *   - codes are drawn from a CSPRNG (crypto.randomInt), not Math.random, so an
 *     attacker can't predict or reproduce the sequence;
 *   - each code is one-time use and TTL-bounded (10 min) — a host has at most one
 *     live code at a time (minting a new one drops the old);
 *   - redeem is rate-limited per source AND globally, so neither a single attacker
 *     nor a distributed botnet can walk the space before codes rotate;
 *   - the number of concurrent live codes is capped to bound memory.
 *
 * With a per-source cap of 5/min, exhausting even 1% of the space against one live
 * code would take a single IP ~1,400 years; the global cap closes the distributed
 * variant at the cost of (intentionally) rate-limiting pairing during an attack.
 */

const TTL_MS = 10 * 60 * 1000;            // a code is valid for 10 minutes
const MAX_ATTEMPTS = 5;                    // redeem attempts per source per window
const MAX_GLOBAL_ATTEMPTS = 60;            // redeem attempts across all sources per window
const ATTEMPT_WINDOW_MS = 60 * 1000;       // sliding window for the attempt caps
const MAX_CODES = 10000;                    // ceiling on concurrent live codes

function createPairingCodes({
  now = Date.now,
  ttlMs = TTL_MS,
  maxAttempts = MAX_ATTEMPTS,
  maxGlobalAttempts = MAX_GLOBAL_ATTEMPTS,
  attemptWindowMs = ATTEMPT_WINDOW_MS,
  maxCodes = MAX_CODES,
} = {}) {
  const codes = new Map();      // code -> { token, expiresAt }
  const ipAttempts = new Map(); // source -> number[] (recent redeem timestamps)
  let globalAttempts = [];      // recent redeem timestamps across all sources

  function sweep(t) {
    for (const [code, rec] of codes) if (rec.expiresAt <= t) codes.delete(code);
  }

  function gen6() {
    // CSPRNG: uniform over the full 000000–999999 space, no modulo bias.
    return String(randomInt(0, 1000000)).padStart(6, '0');
  }

  function mint(token) {
    const t = now();
    sweep(t);
    // A token has at most one live code — drop any earlier one so an old code
    // can't still be redeemed after the panel shows a new one.
    for (const [code, rec] of codes) if (rec.token === token) codes.delete(code);
    if (codes.size >= maxCodes) {
      return { error: 'pairing temporarily unavailable, try again shortly' };
    }
    let code = gen6();
    while (codes.has(code)) code = gen6();
    codes.set(code, { token, expiresAt: t + ttlMs });
    return { code, ttl: Math.round(ttlMs / 1000) };
  }

  // Sliding-window limiter. Returns true (and records nothing more) once the
  // window is full, so a flood stays blocked until older attempts age out.
  function windowFull(list, cap, t) {
    const live = list.filter((ts) => t - ts < attemptWindowMs);
    if (live.length >= cap) return { full: true, live };
    live.push(t);
    return { full: false, live };
  }

  function throttled(t, source) {
    const ip = windowFull(ipAttempts.get(source) || [], maxAttempts, t);
    ipAttempts.set(source, ip.live);
    if (ip.full) return true;
    const g = windowFull(globalAttempts, maxGlobalAttempts, t);
    globalAttempts = g.live;
    return g.full;
  }

  function redeem(code, source = 'default') {
    const t = now();
    if (throttled(t, source)) return { error: 'too many attempts, try again shortly' };
    sweep(t);
    const rec = codes.get(code);
    if (!rec) return { error: 'invalid or expired code' };
    codes.delete(code); // one-time use
    return { token: rec.token };
  }

  // Reclaim attempt buckets whose timestamps have all aged out of the window.
  // Driven by a timer in the server (NOT by socket close) so the per-source limit
  // survives reconnects — otherwise an attacker would reset it by hanging up.
  function gc(t = now()) {
    sweep(t);
    for (const [source, list] of ipAttempts) {
      const live = list.filter((ts) => t - ts < attemptWindowMs);
      if (live.length === 0) ipAttempts.delete(source);
      else ipAttempts.set(source, live);
    }
    globalAttempts = globalAttempts.filter((ts) => t - ts < attemptWindowMs);
  }

  return {
    mint,
    redeem,
    gc,
    size: () => codes.size,
    attemptSources: () => ipAttempts.size,
  };
}

module.exports = { createPairingCodes, TTL_MS };
