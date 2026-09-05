import httpStatus from 'http-status';
import config from '../../config';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import authService from './auth.service';

const REFRESH_COOKIE_NAME = 'refreshToken';

const refreshCookieOptions = {
  httpOnly: true,
  secure: config.env === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, mirrors JWT_REFRESH_EXPIRES_IN default
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
