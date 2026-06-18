import type { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny } from 'zod';
import { ValidationError } from '../lib/errors';

/** Validates and replaces req.body with the parsed result. */
export function validate(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError('Invalid input', result.error.flatten());
    }
    req.body = result.data;
    next();
  };
}
