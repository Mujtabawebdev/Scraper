import type { RequestHandler } from "express";

import type { UserRole } from "../../generated/prisma/enums.js";
import {
  authenticationRequiredError,
  insufficientPermissionsError,
} from "../../modules/auth/auth.errors.js";

export const authorizeRoles = (...allowedRoles: readonly UserRole[]): RequestHandler => {
  const roles = new Set<UserRole>(allowedRoles);
  return (request, _response, next) => {
    if (!request.auth) {
      next(authenticationRequiredError());
      return;
    }
    if (!roles.has(request.auth.role)) {
      next(insufficientPermissionsError());
      return;
    }
    next();
  };
};
