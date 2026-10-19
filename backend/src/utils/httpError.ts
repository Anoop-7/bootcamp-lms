export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "HttpError";
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export const badRequest = (msg = "Bad Request", code?: string) => new HttpError(400, msg, code);
export const unauthorized = (msg = "Unauthorized", code?: string) => new HttpError(401, msg, code);
export const paymentRequired = (msg = "Payment Required", code?: string) => new HttpError(402, msg, code);
export const forbidden = (msg = "Forbidden", code?: string) => new HttpError(403, msg, code);
export const notFound = (msg = "Resource not found", code?: string) => new HttpError(404, msg, code);
export const conflict = (msg = "Conflict", code?: string) => new HttpError(409, msg, code);
export const tooManyRequests = (msg = "Too Many Requests", code?: string) => new HttpError(429, msg, code);
export const internal = (msg = "Internal Server Error", code?: string) => new HttpError(500, msg, code);