import { Router } from "express";

import { authenticate } from "../../common/middleware/authenticate.middleware.js";
import { summary } from "./dashboard.controller.js";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);
dashboardRouter.get("/summary", summary);
