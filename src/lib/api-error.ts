export type ApiErrorBody = {
  success?: boolean;
  statusCode?: number;
  error?: string;
  message?: string;
  path?: string;
};

export class ApiError extends Error {
  readonly statusCode: number;
  readonly error?: string;
  readonly path?: string;

  constructor(
    message: string,
    opts: { statusCode: number; error?: string; path?: string }
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = opts.statusCode;
    this.error = opts.error;
    this.path = opts.path;
  }

  static fromBody(body: unknown, fallbackStatus: number): ApiError {
    if (body && typeof body === "object") {
      const b = body as ApiErrorBody;
      const message =
        typeof b.message === "string" && b.message.length > 0
          ? b.message
          : "Request failed";
      const statusCode =
        typeof b.statusCode === "number" ? b.statusCode : fallbackStatus;
      const error = typeof b.error === "string" ? b.error : undefined;
      const path = typeof b.path === "string" ? b.path : undefined;
      return new ApiError(message, { statusCode, error, path });
    }
    return new ApiError("Request failed", { statusCode: fallbackStatus });
  }
}
