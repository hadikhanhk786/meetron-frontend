// Generate shared encryption key using ECDH
export async function generateECDHKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true,
    ["deriveKey", "deriveBits"]
  );
  return keyPair;
}

// Export public key
export async function exportPublicKey(publicKey) {
  const exported = await crypto.subtle.exportKey("spki", publicKey);
  return arrayBufferToBase64(exported);
}

// Import public key
export async function importPublicKey(base64Key) {
  const buffer = base64ToArrayBuffer(base64Key);
  return await crypto.subtle.importKey(
    "spki",
    buffer,
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true,
    []
  );
}

// Derive shared secret
export async function deriveSharedSecret(privateKey, publicKey) {
  const sharedSecret = await crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: publicKey
    },
    privateKey,
    {
      name: "AES-GCM",
      length: 256
    },
    true,
    ["encrypt", "decrypt"]
  );
  
  return await crypto.subtle.exportKey("raw", sharedSecret);
}

// Helper functions
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
