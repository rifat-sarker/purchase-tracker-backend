import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async controller so any thrown/rejected error is forwarded to
 * Express's centralized error handler instead of crashing the process or
 * requiring manual try/catch in every controller.
 */
const catchAsync = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default catchAsync;
