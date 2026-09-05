import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Application } from 'express';
import helmet from 'helmet';
import httpStatus from 'http-status';
import morgan from 'morgan';
import path from 'path';
import config from './config';
import healthRoute from './modules/health/health.route';
import globalErrorHandler from './middlewares/globalErrorHandler';
import { globalLimiter } from './middlewares/rateLimiter';
import notFound from './middlewares/notFound';
import routes from './routes';
import logger from './utils/logger';

const app: Application = express();

// Required behind any reverse proxy (Vercel, Nginx, a load balancer) —
// without this, Express reads the proxy's own IP as req.ip for every
// request instead of the real client IP (from X-Forwarded-For). That
// breaks express-rate-limit two ways: it either throws on every request
// (all traffic sees 500s) or silently buckets every visitor under one
// shared IP, so one client's traffic can exhaust everyone else's quota.
app.set('trust proxy', 1);

app.use(helmet());

// Explicit CORS allow-list — never `*`. See CORS_ALLOWED_ORIGINS.
app.use(
  cors({
    origin: config.corsAllowedOrigins,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  // Structured request logs in production (method, path, status, duration).
  app.use(
    morgan('combined', {
      stream: { write: (message: string) => logger.info(message.trim()) },
    }),
  );
}

// Local dev file storage — served statically so uploaded referenceImage /
// receiptImages URLs (when Cloudinary isn't configured) are reachable.
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// No in-process session state — auth is pure JWT, so any instance behind
// the load balancer can serve any request.
app.use('/health', healthRoute);

app.use('/api/v1', globalLimiter, routes);

app.get('/', (_req, res) => {
  res.status(httpStatus.OK).json({
    success: true,
    statusCode: httpStatus.OK,
    message: 'Gadget Purchase Tracker API is running',
    data: null,
  });
});

app.use(notFound);
app.use(globalErrorHandler);

export default app;
