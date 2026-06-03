import * as SecureStore from 'expo-secure-store';

/**
 * Pairing persistence — the ONLY thing HELM Mobile stores: the relay URL + the
 * bearer pairing token for the laptop. No code, no secrets, no task content ever
 * lives on the phone (see product.md §1). Kept in the OS secure enclave/keystore
 * via expo-secure-store so the bearer token isn't sitting in plaintext.
 */

const KEY = 'helm.pairing';

/** @returns {Promise<{relay:string, token:string}|null>} */
export async function loadPairing() {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj && typeof obj.relay === 'string' && typeof obj.token === 'string') return obj;
    return null;
  } catch {
    return null;
  }
}

export async function savePairing({ relay, token }) {
  await SecureStore.setItemAsync(KEY, JSON.stringify({ relay, token }));
}

export async function clearPairing() {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* already gone */
  }
}
