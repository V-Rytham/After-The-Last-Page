import { ZodError } from 'zod';
import { ValidationError } from '../lib/errors.js';

export const validateBody = (schema) => (req, res, next) => {
  try {
    req.validatedBody = schema.parse(req.body ?? {});
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      next(new ValidationError('Request validation failed.', error.flatten()));
      return;
    }

    next(error);
  }
};
