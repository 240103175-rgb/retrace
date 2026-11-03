/** A business or request error with a stable code from openapi.yml and an HTTP status. */
export class AppError extends Error {
  constructor(code, status, message = code) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

export const fail = (code, status, message) => {
  throw new AppError(code, status, message);
};
