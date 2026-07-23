import { extname } from "node:path";
import { Router } from "express";
import multer from "multer";

import { AppError } from "../../common/errors/app-error.js";
import { authenticate } from "../../common/middleware/authenticate.middleware.js";
import { csvImportRateLimiter } from "../../common/middleware/resource-rate-limit.middleware.js";
import { env } from "../../config/env.js";
import { create, detail, preview } from "./csv-import.controller.js";

const allowedMimeTypes = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.CSV_IMPORT_MAX_FILE_BYTES,
    files: 1,
    fields: 3,
  },
  fileFilter: (_request, file, callback) => {
    if (
      extname(file.originalname).toLowerCase() !== ".csv" ||
      !allowedMimeTypes.has(file.mimetype.toLowerCase())
    ) {
      callback(
        new AppError(
          400,
          "CSV_IMPORT_INVALID",
          "Only a valid CSV text file is accepted",
        ),
      );
      return;
    }
    callback(null, true);
  },
});

export const csvImportRouter = Router();

csvImportRouter.use(authenticate);
csvImportRouter.post(
  "/csv/preview",
  csvImportRateLimiter,
  upload.single("file"),
  preview,
);
csvImportRouter.post(
  "/csv",
  csvImportRateLimiter,
  upload.single("file"),
  create,
);
csvImportRouter.get("/:importId", detail);
