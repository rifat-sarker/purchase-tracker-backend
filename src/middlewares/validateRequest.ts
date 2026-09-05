import { NextFunction, Request, Response } from 'express';
import { AnyZodObject } from 'zod';
import catchAsync from '../utils/catchAsync';

/**
 * Generic Zod validation middleware. Pass a schema shaped like
 * `z.object({ body: ..., query: ..., params: ... })` (any subset).
 * Parsed/coerced values are written back onto req so downstream
 * controllers/services see clean, typed data.
 */
const validateRequest = (schema: AnyZodObject) =>
  catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const parsed = await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (parsed.body !== undefined) req.body = parsed.body;
    if (parsed.query !== undefined) (req as unknown as { query: unknown }).query = parsed.query;
    if (parsed.params !== undefined) (req as unknown as { params: unknown }).params = parsed.params;

    next();
  });

export default validateRequest;
