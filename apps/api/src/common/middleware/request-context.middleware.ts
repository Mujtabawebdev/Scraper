import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestContextMiddleware: RequestHandler = (request, response, next) => {
  const incomingRequestId = request.get("x-request-id");
  const incomingCorrelationId = request.get("x-correlation-id");

  const requestId = incomingRequestId && incomingRequestId.trim() ? incomingRequestId.trim() : randomUUID();
  const correlationId = incomingCorrelationId && incomingCorrelationId.trim()
    ? incomingCorrelationId.trim()
    : requestId;

  request.id = requestId;
  request.correlationId = correlationId;

  response.setHeader("X-Request-ID", requestId);
  response.setHeader("X-Correlation-ID", correlationId);

  next();
};
