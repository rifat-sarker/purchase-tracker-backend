import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import config from '../config';
import AppError from '../utils/AppError';
import logger from '../utils/logger';

interface ErrorSource {
  path: string;
  message: string;
}

/**
 * Centralized Express error handler. Every error in the app — Zod
 * validation errors, Prisma errors, JWT errors, custom AppError instances,
 * and anything unexpected — funnels through here and is returned in one
 * consistent shape. Stack traces and Prisma/internal details are never
 * leaked to the client in production.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const globalErrorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let message = 'Something went wrong';
  let errorSources: ErrorSource[] = [{ path: '', message: 'Something went wrong' }];

  if (err instanceof ZodError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = 'Validation error';
    errorSources = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    statusCode = httpStatus.BAD_REQUEST;
    if (err.code === 'P2025') {
      statusCode = httpStatus.NOT_FOUND;
      message = 'Requested resource was not found';
    } else if (err.code === 'P2002') {
      message = 'A record with this value already exists';
    } else {
      message = 'Database request error';
    }
    errorSources = [{ path: '', message }];
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = 'Invalid data provided to the database layer';
    errorSources = [{ path: '', message }];
  } else if (err instanceof MulterError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = err.message;
    errorSources = [{ path: err.field ?? '', message: err.message }];
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorSources = [{ path: '', message: err.message }];
  } else if (err instanceof Error) {
    message = err.message || message;
    errorSources = [{ path: '', message }];
    if (err.name === 'JsonWebTokenError') {
      statusCode = httpStatus.UNAUTHORIZED;
      message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
      statusCode = httpStatus.UNAUTHORIZED;
      message = 'Token expired';
    }
  }

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} - ${message}`, err);
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errorSources,
    stack: config.env === 'development' && err instanceof Error ? err.stack : undefined,
  });
};

export default globalErrorHandler;
