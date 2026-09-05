import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import jwt from 'jsonwebtoken';
import config from '../config';
import AppError from '../utils/AppError';

interface AccessTokenPayload {
  id: string;
  email: string;
}

/**
 * requireAuth — runs on all mutation routes (POST/PATCH/DELETE) and any
 * analytics/export routes. Throws 401 if no valid access token is present.
 */
const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid or expired access token');
  }
};

export default requireAuth;
