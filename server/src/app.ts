import { randomUUID } from 'crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { authRouter, usersRouter } from './auth/auth.routes';
import { config } from './config';
import { Deps } from './estimates/estimates.service';
import { estimatesRouter } from './estimates/estimates.routes';
import { log } from './log';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { projectsRouter } from './projects/projects.routes';

export function createApp(deps: Deps): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind a reverse proxy such as nginx

  app.use(helmet());
  const origins = config.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins.length ? origins : false }));
  app.use(express.json({ limit: '1mb' }));

  // One log line per request: id, method, path, status, time. Never bodies, tokens or images.
  app.use((req, res, next) => {
    const id = randomUUID().slice(0, 8);
    const started = Date.now();
    res.on('finish', () => log.info(`${id} ${req.method} ${req.path} ${res.statusCode} ${Date.now() - started}ms`));
    next();
  });

  app.get('/health', (_req, res) => void res.json({ ok: true }));

  const api = express.Router();
  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/projects', projectsRouter);
  api.use(estimatesRouter(deps));
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
