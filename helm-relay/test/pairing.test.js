'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { createPairingCodes } = require('../pairing');

// ---- core behaviour (from the implementation plan) ----

test('mint returns a 6-digit string code and a ttl in seconds', () => {
  const codes = createPairingCodes({ ttlMs: 600000 });
  const { code, ttl } = codes.mint('tok-123');
  assert.match(code, /^\d{6}$/);
  assert.strictEqual(ttl, 600);
});

test('redeem returns the token for a valid code', () => {
  const codes = createPairingCodes();
  const { code } = codes.mint('tok-abc');
  assert.deepStrictEqual(codes.redeem(code), { token: 'tok-abc' });
});

test('a code is one-time: second redeem fails', () => {
  const codes = createPairingCodes();
  const { code } = codes.mint('tok-abc');
  codes.redeem(code);
  assert.ok(codes.redeem(code).error);
});

test('an expired code fails', () => {
  let t = 1000;
  const codes = createPairingCodes({ now: () => t, ttlMs: 5000 });
  const { code } = codes.mint('tok-abc');
  t = 1000 + 5001; // jump past TTL
  assert.ok(codes.redeem(code).error);
});

test('redeem is throttled after too many attempts from one source', () => {
  const codes = createPairingCodes({ maxAttempts: 3 });
  assert.ok(codes.redeem('000000').error); // 1 (miss)
  assert.ok(codes.redeem('000000').error); // 2
  assert.ok(codes.redeem('000000').error); // 3
  const r = codes.redeem('000000');         // 4 -> throttled
  assert.match(r.error, /too many/i);
});

// ---- security hardening ----

test('codes are unguessable: 2000 mints are all unique 6-digit strings', () => {
  // A weak PRNG or an off-by-one in the range would collide or stray out of range.
  const codes = createPairingCodes({ maxCodes: 5000 });
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const { code } = codes.mint('tok-' + i);
    assert.match(code, /^\d{6}$/);
    assert.ok(!seen.has(code), 'duplicate code minted: ' + code);
    seen.add(code);
  }
});

test('per-source throttle does not lock out a different source', () => {
  const codes = createPairingCodes({ maxAttempts: 2 });
  assert.ok(codes.redeem('000000', '1.1.1.1').error); // A #1
  assert.ok(codes.redeem('000000', '1.1.1.1').error); // A #2
  assert.match(codes.redeem('000000', '1.1.1.1').error, /too many/i); // A locked
  // A fresh source is unaffected.
  const b = codes.redeem('000000', '2.2.2.2');
  assert.doesNotMatch(b.error, /too many/i);
});

test('a global cap stops a distributed guessing flood across many sources', () => {
  const codes = createPairingCodes({ maxAttempts: 50, maxGlobalAttempts: 5 });
  for (let i = 0; i < 5; i++) {
    assert.doesNotMatch(codes.redeem('000000', 'ip-' + i).error, /too many/i);
  }
  // A brand-new source, well under its own per-source cap, is still refused.
  assert.match(codes.redeem('000000', 'ip-fresh').error, /too many/i);
});

test('minting a fresh code for a token invalidates that token\'s previous code', () => {
  const codes = createPairingCodes();
  const first = codes.mint('tok-x').code;
  const second = codes.mint('tok-x').code;
  assert.notStrictEqual(first, second);
  assert.ok(codes.redeem(first).error, 'the old code should no longer work');
  assert.deepStrictEqual(codes.redeem(second), { token: 'tok-x' });
});

test('mint refuses once the active-code ceiling is reached (anti-exhaustion)', () => {
  const codes = createPairingCodes({ maxCodes: 2 });
  assert.ok(codes.mint('a').code);
  assert.ok(codes.mint('b').code);
  assert.ok(codes.mint('c').error, 'should refuse a third concurrent code');
});

test('expired codes are swept so they do not count toward the ceiling', () => {
  let t = 1000;
  const codes = createPairingCodes({ now: () => t, ttlMs: 1000, maxCodes: 2 });
  codes.mint('a');
  codes.mint('b');
  t += 2000; // both expire
  assert.ok(codes.mint('c').code, 'capacity should free up after expiry');
});

test('gc drops stale per-source buckets but keeps the limit alive within the window', () => {
  let t = 1000;
  const codes = createPairingCodes({ now: () => t, maxAttempts: 2, attemptWindowMs: 1000 });
  codes.redeem('000000', '9.9.9.9'); // 1 attempt recorded
  assert.strictEqual(codes.attemptSources(), 1);
  // Still inside the window: gc must NOT forget the source (else reconnects bypass it).
  t += 500;
  codes.gc(t);
  assert.strictEqual(codes.attemptSources(), 1, 'live bucket must survive gc');
  // After the window fully passes, the stale bucket is reclaimed.
  t += 1000;
  codes.gc(t);
  assert.strictEqual(codes.attemptSources(), 0, 'stale bucket should be reclaimed');
});
