export const ENCRYPTION_ALGORITHM = 'AES-GCM';
export const IV_LENGTH = 12;

/**
 * Imports a raw key (from server) into a CryptoKey.
 * @param rawKey The raw key bytes.
 * @returns The CryptoKey.
 */
export async function importKeyFromRaw(rawKey: Uint8Array): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    'raw',
    rawKey as unknown as BufferSource,
    { name: ENCRYPTION_ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts data using AES-GCM.
 * @param data The data to encrypt (as a Uint8Array or ArrayBuffer).
 * @param key The cryptographic key to use.
 * @returns An object containing the encrypted data (ciphertext) and the initialization vector (iv).
 */
export async function encryptData(data: Uint8Array | ArrayBuffer, key: CryptoKey): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: ENCRYPTION_ALGORITHM,
      iv: iv as unknown as BufferSource,
    },
    key,
    data as unknown as BufferSource
  );

  return { ciphertext: new Uint8Array(encrypted), iv };
}

/**
 * Decrypts data using AES-GCM.
 * @param encryptedData The encrypted data (ciphertext).
 * @param key The cryptographic key to use.
 * @param iv The initialization vector used during encryption.
 * @returns The decrypted data as a Uint8Array.
 */
export async function decryptData(encryptedData: Uint8Array | ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<Uint8Array> {
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: ENCRYPTION_ALGORITHM,
      iv: iv as unknown as BufferSource,
    },
    key,
    encryptedData as unknown as BufferSource
  );

  return new Uint8Array(decrypted);
}

/**
 * Helper to combine iv and ciphertext into a single buffer for storage (when key is known/fetched).
 * Format: [IV (12 bytes)] [Ciphertext (...)]
 */
export function packIVAndCiphertext(iv: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  const packed = new Uint8Array(iv.length + ciphertext.length);
  packed.set(iv, 0);
  packed.set(ciphertext, iv.length);
  return packed;
}

/**
 * Helper to unpack iv and ciphertext.
 */
export function unpackIVAndCiphertext(packedData: Uint8Array): { iv: Uint8Array; ciphertext: Uint8Array } {
  if (packedData.length < IV_LENGTH) {
    throw new Error('Invalid encrypted data format');
  }
  const iv = packedData.slice(0, IV_LENGTH);
  const ciphertext = packedData.slice(IV_LENGTH);
  return { iv, ciphertext };
}

