import type { RequestHandler } from "express";

export const securityHeadersMiddleware: RequestHandler = (_request, response, next) => {
  response.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), display-capture=()",
  );
  response.setHeader("X-XSS-Protection", "1; mode=block");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  next();
};
