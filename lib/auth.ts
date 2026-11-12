/**
 * FormGuard Pro — Authentication & Session Token Utilities
 * Built with standard Web Crypto API for full compatibility with
 * Next.js Edge Middleware and Node.js Server Runtime.
 */

export const DEFAULT_ADMIN_USERNAME = 'admin';
export const DEFAULT_ADMIN_PASSWORD = 'FormGuard@2026';
export const AUTH_COOKIE_NAME = 'fgp_session';

// 24 hours standard session, 7 days if "Remember me"
export const DEFAULT_SESSION_EXPIRY_SECONDS = 60 * 60 * 24;
export const REMEMBER_SESSION_EXPIRY_SECONDS = 60 * 60 * 24 * 7;

function getAuthSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.CRON_SECRET ||
    'formguard-pro-internal-auth-secret-key-2026'
  );
}

function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Generate cryptographically random hex salt */
export function generateSalt(length: number = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compute salted SHA-256 password hash */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${password}:${salt}:${getAuthSecret()}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Timing-safe password verification */
export async function verifyPassword(
  provided: string,
  storedHash: string,
  salt: string
): Promise<boolean> {
  if (!provided || !storedHash || !salt) return false;
  const computedHash = await hashPassword(provided, salt);
  if (computedHash.length !== storedHash.length) return false;

  let mismatch = 0;
  for (let i = 0; i < computedHash.length; i++) {
    mismatch |= computedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Creates an HMAC-SHA256 signed session token:
 * format: <base64url(payload)>.<base64url(signature)>
 */
export async function createSessionToken(
  payload: { username: string },
  expiresInSeconds: number = DEFAULT_SESSION_EXPIRY_SECONDS
): Promise<string> {
  const enc = new TextEncoder();
  const tokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    iat: Math.floor(Date.now() / 1000),
  };

  const payloadJson = JSON.stringify(tokenPayload);
  const payloadEncoded = base64UrlEncode(enc.encode(payloadJson));

  const secretKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(getAuthSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    secretKey,
    enc.encode(payloadEncoded)
  );

  const signatureEncoded = base64UrlEncode(new Uint8Array(signature));
  return `${payloadEncoded}.${signatureEncoded}`;
}

/**
 * Verifies HMAC-SHA256 signature and expiry of a session token.
 * Returns decoded payload if valid, null otherwise.
 */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<{ username: string; exp: number } | null> {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadEncoded, signatureEncoded] = parts;

  try {
    const enc = new TextEncoder();
    const secretKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(getAuthSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = base64UrlDecode(signatureEncoded);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      secretKey,
      signatureBytes as unknown as BufferSource,
      enc.encode(payloadEncoded)
    );

    if (!isValid) return null;

    const payloadBytes = base64UrlDecode(payloadEncoded);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadJson);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}
