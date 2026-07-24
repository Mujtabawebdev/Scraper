import type { ErrorRequestHandler } from "express";

import { Prisma } from "../../generated/prisma/client.js";
import { logger } from "../logger/logger.js";
import { AppError } from "../errors/app-error.js";

const isInvalidJsonError = (error: unknown): boolean =>
  error instanceof SyntaxError &&
  typeof error === "object" &&
  error !== null &&
  "status" in error &&
  error.status === 400;

export const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      success: false,
      message: error.message,
      error: {
        code: error.code,
        ...(error.details ?? {}),
      },
    });
    return;
  }

  if (isInvalidJsonError(error)) {
    response.status(400).json({
      success: false,
      message: "Request body contains invalid JSON",
      error: { code: "VALIDATION_ERROR" },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    response.status(409).json({
      success: false,
      message: "The requested resource conflicts with an existing record",
      error: { code: "RESOURCE_CONFLICT" },
    });
    return;
  }

  logger.error(
    {
      requestId: request.id,
      correlationId: request.correlationId,
      userId: request.auth?.userId,
      errorType: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
      method: request.method,
      path: request.path,
    },
    "Unhandled API error",
  );
  response.status(500).json({
    success: false,
    message: "An unexpected error occurred",
    error: { code: "INTERNAL_SERVER_ERROR" },
  });
};
