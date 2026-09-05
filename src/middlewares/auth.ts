import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';

interface AccessTokenPayload {
  id: string;
  email: string;
}

/**
 * attachUserIfPresent — runs on all GET routes.
 * If a valid JWT access token is present in the Authorization header,
 * sets req.user. If absent or invalid, it does NOT throw — it just
 * proceeds with req.user left undefined, so public visitors can still
 * hit the route and get the sanitized DTO shape.
 */
const attachUserIfPresent = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
    req.user = { id: decoded.id, email: decoded.email };
  } catch {
    // invalid/expired token — treat as an unauthenticated (public) request
  }

  next();
};

export default attachUserIfPresent;
