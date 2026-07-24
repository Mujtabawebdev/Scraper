import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearAllAccountLockouts,
  isAccountLocked,
  recordFailedLogin,
  resetFailedLogins,
} from "./account-lockout.service.js";

const TEST_EMAIL = "lockout-test@example.com";
const OTHER_EMAIL = "other-lockout-test@example.com";

describe("Account Lockout Service", () => {
  beforeEach(() => {
    clearAllAccountLockouts();
  });

  afterEach(() => {
    clearAllAccountLockouts();
  });

  describe("isAccountLocked", () => {
    it("returns not locked for a fresh email", () => {
      const result = isAccountLocked(TEST_EMAIL);
      expect(result.locked).toBe(false);
    });

    it("is case-insensitive for email normalization", () => {
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(TEST_EMAIL.toUpperCase());
      }
      const result = isAccountLocked(TEST_EMAIL.toLowerCase());
      expect(result.locked).toBe(true);
    });
  });

  describe("recordFailedLogin", () => {
    it("does not lock after fewer than 5 failed attempts", () => {
      for (let i = 0; i < 4; i++) {
        const result = recordFailedLogin(TEST_EMAIL);
        expect(result.locked).toBe(false);
        expect(result.attemptsLeft).toBeGreaterThan(0);
      }
    });

    it("locks account after exactly 5 consecutive failed attempts", () => {
      let lastResult: { locked: boolean; attemptsLeft: number } | null = null;
      for (let i = 0; i < 5; i++) {
        lastResult = recordFailedLogin(TEST_EMAIL);
      }
      expect(lastResult?.locked).toBe(true);
      expect(lastResult?.attemptsLeft).toBe(0);
    });

    it("isAccountLocked returns locked=true after 5 failures", () => {
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(TEST_EMAIL);
      }
      const lockStatus = isAccountLocked(TEST_EMAIL);
      expect(lockStatus.locked).toBe(true);
      expect(lockStatus.remainingMs).toBeGreaterThan(0);
    });

    it("tracks failures per email independently", () => {
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(TEST_EMAIL);
      }
      const otherResult = isAccountLocked(OTHER_EMAIL);
      expect(otherResult.locked).toBe(false);
    });

    it("decrements attemptsLeft correctly", () => {
      const first = recordFailedLogin(TEST_EMAIL);
      expect(first.attemptsLeft).toBe(4);

      const second = recordFailedLogin(TEST_EMAIL);
      expect(second.attemptsLeft).toBe(3);
    });
  });

  describe("resetFailedLogins", () => {
    it("clears failed attempts so account is no longer locked", () => {
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(TEST_EMAIL);
      }
      expect(isAccountLocked(TEST_EMAIL).locked).toBe(true);

      resetFailedLogins(TEST_EMAIL);
      expect(isAccountLocked(TEST_EMAIL).locked).toBe(false);
    });

    it("does not affect other emails when resetting one", () => {
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(TEST_EMAIL);
        recordFailedLogin(OTHER_EMAIL);
      }
      resetFailedLogins(TEST_EMAIL);

      expect(isAccountLocked(TEST_EMAIL).locked).toBe(false);
      expect(isAccountLocked(OTHER_EMAIL).locked).toBe(true);
    });

    it("allows further login attempts after reset", () => {
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(TEST_EMAIL);
      }
      resetFailedLogins(TEST_EMAIL);

      const afterReset = recordFailedLogin(TEST_EMAIL);
      expect(afterReset.locked).toBe(false);
      expect(afterReset.attemptsLeft).toBe(4);
    });
  });

  describe("clearAllAccountLockouts", () => {
    it("clears all lockouts at once", () => {
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(TEST_EMAIL);
        recordFailedLogin(OTHER_EMAIL);
      }
      clearAllAccountLockouts();
      expect(isAccountLocked(TEST_EMAIL).locked).toBe(false);
      expect(isAccountLocked(OTHER_EMAIL).locked).toBe(false);
    });
  });
});
