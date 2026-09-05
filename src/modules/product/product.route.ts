import { Router } from 'express';
import attachUserIfPresent from '../../middlewares/auth';
import { publicReadLimiter } from '../../middlewares/rateLimiter';
import requireAuth from '../../middlewares/requireAuth';
import { productImageUpload } from '../../middlewares/upload';
import validateRequest from '../../middlewares/validateRequest';
import productController from './product.controller';
import productValidation from './product.validation';

const router = Router();

// Order matters: /export/csv must be registered before /:id or Express
// would treat "export" as an :id param.
router.get('/export/csv', requireAuth, productController.exportCsv);

router.get(
  '/',
  publicReadLimiter,
  attachUserIfPresent,
  validateRequest(productValidation.getProductsQuerySchema),
  productController.getProducts,
);

router.get('/:id', publicReadLimiter, attachUserIfPresent, productController.getProductById);

router.post(
  '/',
  requireAuth,
  productImageUpload,
  validateRequest(productValidation.createProductSchema),
  productController.createProduct,
);

router.patch(
  '/:id',
  requireAuth,
  productImageUpload,
  validateRequest(productValidation.updateProductSchema),
  productController.updateProduct,
);

router.delete('/:id', requireAuth, productController.deleteProduct);

export default router;
