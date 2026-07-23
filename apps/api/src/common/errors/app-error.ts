export type AppErrorDetails = Readonly<Record<string, unknown>>;

type AppErrorOptions = {
  cause?: unknown;
  details?: AppErrorDetails;
};

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: AppErrorDetails | undefined;

  constructor(statusCode: number, code: string, message: string, options: AppErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = options.details;
  }
}
