// Crypto worker for end-to-end encryption using Insertable Streams
let encryptionKey = null;

// Generate AES-GCM key
async function generateKey() {
  return await crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256
    },
    true,
    ["encrypt", "decrypt"]
  );
}

// Encrypt frame
async function encryptFrame(encodedFrame, controller) {
  if (!encryptionKey) {
    controller.enqueue(encodedFrame);
    return;
  }

  try {
    const view = new DataView(encodedFrame.data);
    const newData = new ArrayBuffer(encodedFrame.data.byteLength + 16); // 16 bytes for IV
    const newView = new DataView(newData);

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the data
    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      encryptionKey,
      encodedFrame.data
    );

    // Copy IV to the beginning
    new Uint8Array(newData, 0, 12).set(iv);
    
    // Copy encrypted data after IV
    new Uint8Array(newData, 12).set(new Uint8Array(encrypted));

    encodedFrame.data = newData;
    controller.enqueue(encodedFrame);
  } catch (error) {
    console.error("Encryption error:", error);
    controller.enqueue(encodedFrame);
  }
}

// Decrypt frame
async function decryptFrame(encodedFrame, controller) {
  if (!encryptionKey) {
    controller.enqueue(encodedFrame);
    return;
  }

  try {
    const view = new DataView(encodedFrame.data);
    
    // Extract IV from the beginning
    const iv = new Uint8Array(encodedFrame.data, 0, 12);
    
    // Extract encrypted data
    const encryptedData = new Uint8Array(encodedFrame.data, 12);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      encryptionKey,
      encryptedData
    );

    encodedFrame.data = decrypted;
    controller.enqueue(encodedFrame);
  } catch (error) {
    console.error("Decryption error:", error);
    // Drop frame if decryption fails
  }
}

// Handle transform event
onrtctransform = (event) => {
  const transformer = event.transformer;
  const { readable, writable } = transformer;
  const { operation } = transformer.options;

  if (operation === "encrypt") {
    readable
      .pipeThrough(new TransformStream({
        transform: encryptFrame
      }))
      .pipeTo(writable);
  } else if (operation === "decrypt") {
    readable
      .pipeThrough(new TransformStream({
        transform: decryptFrame
      }))
      .pipeTo(writable);
  }
};

// Handle messages from main thread
self.addEventListener("message", async (event) => {
  if (event.data.type === "set-key") {
    // Import the encryption key
    const keyData = event.data.key;
    encryptionKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"]
    );
    console.log("Encryption key set in worker");
  }
});
