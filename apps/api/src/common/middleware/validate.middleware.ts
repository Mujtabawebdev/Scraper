import type { RequestHandler } from "express";
import type { ZodType } from "zod";

import { AppError } from "../errors/app-error.js";

export const validateBody = (schema: ZodType): RequestHandler<Record<string, string>, unknown, unknown> => {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      next(
        new AppError(400, "VALIDATION_ERROR", "Request validation failed", {
          details: { issues: result.error.issues },
        }),
      );
      return;
    }

    request.body = result.data;
    next();
  };
};
