import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';

const notFound = (req: Request, res: Response, _next: NextFunction): void => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    statusCode: httpStatus.NOT_FOUND,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    data: null,
  });
};

export default notFound;
