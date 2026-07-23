import { Router } from "express";

import { authenticate } from "../../common/middleware/authenticate.middleware.js";
import { available } from "./source.controller.js";

export const sourceRouter = Router();

sourceRouter.use(authenticate);
sourceRouter.get("/available", available);
