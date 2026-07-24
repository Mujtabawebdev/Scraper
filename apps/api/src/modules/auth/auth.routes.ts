import { rateLimit } from "express-rate-limit";
import { Router, type Request, type Response } from "express";

import { authenticate } from "../../common/middleware/authenticate.middleware.js";
import { validateBody } from "../../common/middleware/validate.middleware.js";
import { env } from "../../config/env.js";
import {
  listSessions,
  login,
  logout,
  logoutAll,
  me,
  refresh,
  register,
  revokeSessionHandler,
} from "./auth.controller.js";
import {
  emptyAuthBodySchema,
  loginSchema,
  registerSchema,
} from "./auth.schemas.js";

const createAuthRateLimiter = (windowMs: number, max: number) =>
  rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request: Request, response: Response) => {
      response.status(429).json({
        success: false,
        message: "Too many authentication requests; please try again later",
        error: { code: "AUTH_RATE_LIMIT_EXCEEDED" },
      });
    },
  });

const registerRateLimiter = createAuthRateLimiter(
  env.AUTH_REGISTER_RATE_LIMIT_WINDOW_MS,
  env.AUTH_REGISTER_RATE_LIMIT_MAX,
);
const loginRateLimiter = createAuthRateLimiter(
  env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
  env.AUTH_LOGIN_RATE_LIMIT_MAX,
);
const refreshRateLimiter = createAuthRateLimiter(
  env.AUTH_REFRESH_RATE_LIMIT_WINDOW_MS,
  env.AUTH_REFRESH_RATE_LIMIT_MAX,
);

export const authRouter = Router();

authRouter.use((_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Pragma", "no-cache");
  next();
});

authRouter.post("/register", registerRateLimiter, validateBody(registerSchema), register);
authRouter.post("/login", loginRateLimiter, validateBody(loginSchema), login);
authRouter.post("/refresh", refreshRateLimiter, validateBody(emptyAuthBodySchema), refresh);
authRouter.post("/logout", logout);
authRouter.post("/logout-all", authenticate, logoutAll);
authRouter.get("/me", authenticate, me);
authRouter.get("/sessions", authenticate, listSessions);
authRouter.delete("/sessions/:sessionId", authenticate, revokeSessionHandler);
