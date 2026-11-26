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
    // Snapshot now: a mounted router rewrites req.url while matching and only restores it via next(),
    // which a successful handler never calls (it responds directly), so reading req.path lazily in the
    // 'finish' callback below would show whatever prefix the deepest router had already stripped.
    const { method, path } = req;
    res.on('finish', () => log.info(`${id} ${method} ${path} ${res.statusCode} ${Date.now() - started}ms`));
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
