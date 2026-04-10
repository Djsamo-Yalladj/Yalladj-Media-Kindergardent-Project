import bcrypt from 'bcryptjs';

// Cost factor 12 — ~250ms per hash on modern hardware.
// Serverless cold-start safe (bcryptjs is pure JS, no native bindings).
const BCRYPT_COST = 12;

// Minimum policy; front-end should enforce stricter. Backend is last line of defense.
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128; // bcrypt truncates at 72 bytes — reject absurdly long input

export class PasswordPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PasswordPolicyError';
  }
}

export function assertPasswordPolicy(plain: string): void {
  if (typeof plain !== 'string') {
    throw new PasswordPolicyError('password must be a string');
  }
  if (plain.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordPolicyError(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (plain.length > MAX_PASSWORD_LENGTH) {
    throw new PasswordPolicyError(`password must be at most ${MAX_PASSWORD_LENGTH} characters`);
  }
}

export async function hashPassword(plain: string): Promise<string> {
  assertPasswordPolicy(plain);
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (typeof plain !== 'string' || typeof hash !== 'string' || hash.length === 0) {
    return false;
  }
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    // malformed hash — treat as mismatch, never throw from auth path
    return false;
  }
}
