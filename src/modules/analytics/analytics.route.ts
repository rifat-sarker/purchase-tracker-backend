import { Router } from 'express';
import requireAuth from '../../middlewares/requireAuth';
import analyticsController from './analytics.controller';

const router = Router();

// All analytics routes are owner-only — they operate on sensitive price data.
router.use(requireAuth);

router.get('/summary', analyticsController.getSummary);
router.get('/by-category', analyticsController.getByCategory);
router.get('/by-month', analyticsController.getByMonth);
router.get('/upcoming-warranty', analyticsController.getUpcomingWarranty);

export default router;
