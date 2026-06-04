export const sessionCookieName = "alignerlog_session";

function getAuthSecret() {
  const secret = process.env.ALIGNERLOG_AUTH_SECRET;

  if (!secret || secret.trim().length < 32) {
    throw new Error("ALIGNERLOG_AUTH_SECRET must be at least 32 characters.");
  }

  return secret.trim();
}

function base64UrlToBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);

  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));

  return bytesToBase64Url(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = base64UrlToBytes(left);
  const rightBytes = base64UrlToBytes(right);

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  let diff = 0;
  leftBytes.forEach((byte, index) => {
    diff |= byte ^ rightBytes[index];
  });

  return diff === 0;
}

export async function verifySessionToken(token: string | undefined | null) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || !constantTimeEqual(await sign(payload), signature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as {
      userId?: string;
      issuedAt?: number;
    };
    const now = Math.floor(Date.now() / 1000);
    const maxAgeSeconds = 60 * 60 * 24 * 30;

    if (!parsed.userId || !parsed.issuedAt || now - parsed.issuedAt > maxAgeSeconds) {
      return null;
    }

    return { userId: parsed.userId };
  } catch {
    return null;
  }
}
