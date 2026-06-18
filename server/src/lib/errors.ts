/** Typed application errors mapped to HTTP status + JSON {error, code} by the error handler. */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class Unauthorized extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHENTICATED', message, 401);
  }
}

export class Forbidden extends AppError {
  constructor(message = 'You do not have permission to do that') {
    super('FORBIDDEN', message, 403);
  }
}

export class NotFound extends AppError {
  constructor(message = 'Not found') {
    super('NOT_FOUND', message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid input', details?: unknown) {
    super('VALIDATION', message, 400, details);
  }
}

export class Conflict extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super('CONFLICT', message, 409, details);
  }
}
