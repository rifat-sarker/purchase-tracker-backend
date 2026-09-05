import httpStatus from 'http-status';
import config from '../../config';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import authService from './auth.service';

const REFRESH_COOKIE_NAME = 'refreshToken';

/**
 * Parses simple duration strings ("30d", "12h", "15m", "45s") the same way
 * JWT_ACCESS_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN are written in .env, so the
 * refresh cookie's maxAge always matches the actual refresh token's JWT
 * expiry instead of a second hardcoded number that can silently drift out
 * of sync with it.
 */
function parseDurationMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000; // fallback: 7 days
  const amount = Number(match[1]);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return amount * unitMs;
}

const refreshCookieOptions = {
  httpOnly: true,
  secure: config.env === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: parseDurationMs(config.jwt.refreshExpiresIn),
};

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const { accessToken, refreshToken } = await authService.login(email, password);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Logged in successfully',
    data: { accessToken },
  });
});

const refresh = catchAsync(async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!refreshToken) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: 'No refresh token cookie present',
    });
  }

  const { accessToken } = await authService.refresh(refreshToken);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Access token refreshed',
    data: { accessToken },
  });
});

const logout = catchAsync(async (_req, res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: refreshCookieOptions.path });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Logged out successfully',
    data: null,
  });
});

export default { login, refresh, logout };
