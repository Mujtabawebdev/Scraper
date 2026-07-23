import type { Request, Response } from "express";
import type { ZodType } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import { authenticationRequiredError } from "../auth/auth.errors.js";
import { csvImportInvalidError } from "./csv-import.errors.js";
import {
  csvImportFieldsSchema,
  csvImportParamsSchema,
  parseHeaderMapping,
} from "./csv-import.schemas.js";
import {
  createCsvImport,
  getCsvImport,
  previewCsvImport,
} from "./csv-import.service.js";

const parse = <Output>(schema: ZodType<Output>, value: unknown): Output => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", {
      details: { issues: result.error.issues },
    });
  }
  return result.data;
};

const requireUserId = (request: Request): string => {
  if (!request.auth) throw authenticationRequiredError();
  return request.auth.userId;
};

const requireFile = (request: Request): Express.Multer.File => {
  if (!request.file) throw csvImportInvalidError("A CSV file is required");
  return request.file;
};

const mappingFrom = (value: string | undefined) => {
  try {
    return parseHeaderMapping(value);
  } catch {
    throw csvImportInvalidError("Header mapping is invalid");
  }
};

export const preview = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const fields = parse(csvImportFieldsSchema, request.body);
  response.status(200).json({
    success: true,
    message: "CSV preview generated successfully",
    data: {
      preview: previewCsvImport(
        requireFile(request),
        mappingFrom(fields.headerMapping),
      ),
    },
  });
};

export const create = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const fields = parse(csvImportFieldsSchema, request.body);
  const csvImport = await createCsvImport({
    userId: requireUserId(request),
    file: requireFile(request),
    sourceName: fields.sourceName,
    mapping: mappingFrom(fields.headerMapping),
  });
  response.status(202).json({
    success: true,
    message: "CSV import queued successfully",
    data: { import: csvImport },
  });
};

export const detail = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = parse(csvImportParamsSchema, request.params);
  response.status(200).json({
    success: true,
    message: "CSV import fetched successfully",
    data: {
      import: await getCsvImport(requireUserId(request), params.importId),
    },
  });
};
