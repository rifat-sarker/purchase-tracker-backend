import { Router } from 'express';
import httpStatus from 'http-status';
import config from '../../config';
import AppError from '../../utils/AppError';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import warrantyService from './warranty.service';

const router = Router();

/**
 * Triggered by Vercel Cron (see vercel.json) instead of node-cron — a
 * serverless deployment has no persistent process to keep an in-process
 * scheduler alive, so the "daily at 08:00" job becomes a scheduled HTTP
 * call to this route instead. Vercel automatically sends
 * `Authorization: Bearer $CRON_SECRET` on cron-triggered requests when
 * the CRON_SECRET env var is set on the project, so this doubles as auth
 * — without it, this endpoint would let anyone spam warranty emails.
 *
 * Still mounted (and still works) when running the traditional
 * node-cron-based server locally/on a VPS — it's just an extra manual
 * trigger in that case.
 */
router.get(
  '/run',
  catchAsync(async (req, res) => {
    const authHeader = req.headers.authorization;
    const expected = `Bearer ${config.cronSecret}`;

    if (!config.cronSecret || authHeader !== expected) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid or missing cron secret');
    }

    const result = await warrantyService.checkAndNotifyExpiringWarranties();

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Warranty check completed',
      data: result,
    });
  }),
);

export default router;
