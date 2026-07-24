type LockoutRecord = {
  failedAttempts: number;
  firstFailedAt: number;
  lockedUntil: number | null;
};

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1_000; // 15 minutes
const LOCKOUT_DURATION_MS = 15 * 60 * 1_000; // 15 minutes

const lockoutStore = new Map<string, LockoutRecord>();

export const isAccountLocked = (email: string): { locked: boolean; remainingMs?: number } => {
  const normalizedEmail = email.trim().toLowerCase();
  const record = lockoutStore.get(normalizedEmail);
  if (!record || !record.lockedUntil) {
    return { locked: false };
  }

  const now = Date.now();
  if (now >= record.lockedUntil) {
    lockoutStore.delete(normalizedEmail);
    return { locked: false };
  }

  return {
    locked: true,
    remainingMs: record.lockedUntil - now,
  };
};

export const recordFailedLogin = (email: string): { locked: boolean; attemptsLeft: number } => {
  const normalizedEmail = email.trim().toLowerCase();
  const now = Date.now();
  let record = lockoutStore.get(normalizedEmail);

  if (!record || now - record.firstFailedAt > WINDOW_MS) {
    record = {
      failedAttempts: 1,
      firstFailedAt: now,
      lockedUntil: null,
    };
  } else {
    record.failedAttempts += 1;
  }

  if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    lockoutStore.set(normalizedEmail, record);
    return { locked: true, attemptsLeft: 0 };
  }

  lockoutStore.set(normalizedEmail, record);
  return {
    locked: false,
    attemptsLeft: MAX_FAILED_ATTEMPTS - record.failedAttempts,
  };
};

export const resetFailedLogins = (email: string): void => {
  const normalizedEmail = email.trim().toLowerCase();
  lockoutStore.delete(normalizedEmail);
};

export const clearAllAccountLockouts = (): void => {
  lockoutStore.clear();
};
