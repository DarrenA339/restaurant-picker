/**
 * Six-character join codes. The alphabet skips 0/O and 1/I/L so a code read
 * aloud or typed from a photo can't be confused. The database only requires
 * ^[A-Z0-9]{6}$.
 */

export const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 6;

const JOIN_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export function randomJoinCode(): string {
  const bytes = new Uint8Array(JOIN_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) {
    code += JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length];
  }
  return code;
}

/** Uppercases and trims what someone typed; null if it can't be a code. */
export function normalizeJoinCode(input: string | undefined | null): string | null {
  const code = (input ?? "").trim().toUpperCase();
  return JOIN_CODE_PATTERN.test(code) ? code : null;
}
