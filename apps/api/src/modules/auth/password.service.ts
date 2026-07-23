import { randomBytes } from "node:crypto";

import { argon2id, hash, verify } from "argon2";

const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

const ARGON2ID_PREFIX = "$argon2id$";
const dummyHashPromise = hash(randomBytes(32), ARGON2_OPTIONS);

export class PasswordServiceError extends Error {
  constructor() {
    super("Password processing failed");
    this.name = "PasswordServiceError";
  }
}

export const hashPassword = async (password: string): Promise<string> => {
  try {
    return await hash(password, ARGON2_OPTIONS);
  } catch {
    throw new PasswordServiceError();
  }
};

export const verifyPassword = async (passwordHash: string, password: string): Promise<boolean> => {
  let dummyHash: string;
  try {
    dummyHash = await dummyHashPromise;
  } catch {
    throw new PasswordServiceError();
  }

  if (!passwordHash.startsWith(ARGON2ID_PREFIX)) {
    try {
      await verify(dummyHash, password);
      return false;
    } catch {
      throw new PasswordServiceError();
    }
  }

  try {
    return await verify(passwordHash, password);
  } catch {
    try {
      await verify(dummyHash, password);
      return false;
    } catch {
      throw new PasswordServiceError();
    }
  }
};
