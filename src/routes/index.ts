import { Router } from 'express';
import analyticsRoutes from '../modules/analytics/analytics.route';
import authRoutes from '../modules/auth/auth.route';
import productRoutes from '../modules/product/product.route';

const router = Router();

const moduleRoutes = [
  { path: '/auth', route: authRoutes },
  { path: '/products', route: productRoutes },
  { path: '/analytics', route: analyticsRoutes },
];

moduleRoutes.forEach(({ path, route }) => router.use(path, route));

export default router;
