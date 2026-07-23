import { Router } from "express";

import { authenticate } from "../../common/middleware/authenticate.middleware.js";
import { authorizeRoles } from "../../common/middleware/authorize.middleware.js";
import {
  auditLogs,
  cancelJob,
  createSource,
  disableSource,
  jobDetail,
  jobs,
  markSourceReviewRequired,
  sourceDetail,
  sources,
  summary,
  updateSource,
  updateUserRole,
  updateUserStatus,
  userDetail,
  users,
} from "./admin.controller.js";

export const adminRouter = Router();

adminRouter.use(authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"));

adminRouter.get("/summary", summary);

adminRouter.get("/users", users);
adminRouter.get("/users/:userId", userDetail);
adminRouter.patch("/users/:userId/status", updateUserStatus);
adminRouter.patch(
  "/users/:userId/role",
  authorizeRoles("SUPER_ADMIN"),
  updateUserRole,
);

adminRouter.get("/scraping-jobs", jobs);
adminRouter.get("/scraping-jobs/:jobId", jobDetail);
adminRouter.post("/scraping-jobs/:jobId/cancel", cancelJob);

adminRouter.get("/audit-logs", auditLogs);

adminRouter.get("/sources", sources);
adminRouter.get("/sources/:sourceId", sourceDetail);
adminRouter.post("/sources", authorizeRoles("SUPER_ADMIN"), createSource);
adminRouter.patch(
  "/sources/:sourceId",
  authorizeRoles("SUPER_ADMIN"),
  updateSource,
);
adminRouter.post(
  "/sources/:sourceId/disable",
  authorizeRoles("SUPER_ADMIN"),
  disableSource,
);
adminRouter.post(
  "/sources/:sourceId/mark-review-required",
  authorizeRoles("SUPER_ADMIN"),
  markSourceReviewRequired,
);
