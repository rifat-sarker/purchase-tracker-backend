import bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import jwt, { SignOptions } from 'jsonwebtoken';
import config from '../../config';
import prisma from '../../lib/prisma';
import AppError from '../../utils/AppError';

interface TokenPayload {
  id: string;
  email: string;
}

const generateAccessToken = (payload: TokenPayload): string =>
  jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  } as SignOptions);

const generateRefreshToken = (payload: TokenPayload): string =>
  jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as SignOptions);

/**
 * Validates credentials against the single seeded owner account and
 * returns a fresh access + refresh token pair.
 */
const login = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
  }

  const payload: TokenPayload = { id: user.id, email: user.email };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

/**
 * Verifies a refresh token (from the httpOnly cookie) and issues a new
 * access token. Re-checks the user still exists in case the DB was reset.
 */
const refresh = async (refreshToken: string) => {
  let decoded: TokenPayload;

  try {
    decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as TokenPayload;
  } catch {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });

  if (!user) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User no longer exists');
  }

  const accessToken = generateAccessToken({ id: user.id, email: user.email });

  return { accessToken };
};

export default { login, refresh, generateAccessToken, generateRefreshToken };
