// Vercel serverless entry point. Anything under /api becomes a function;
// vercel.json rewrites every request path here, so the whole Express app
// (still mounted at /health and /api/v1/* exactly as in app.ts) runs as
// one function per invocation. Deliberately does NOT call app.listen() or
// schedule node-cron — see src/server.ts for the persistent-process
// equivalent used on a VPS/Docker deployment instead.
import app from '../src/app';

export default app;
