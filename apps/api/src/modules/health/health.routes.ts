import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_request, response) => {
  response.status(200).json({
    success: true,
    message: "US Business Lead SaaS API is healthy",
    data: { service: "api", timestamp: new Date().toISOString() },
  });
});
