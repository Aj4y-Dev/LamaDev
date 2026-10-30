import { Router } from 'express';
import multer from 'multer';
import { badRequest } from '../lib/errors';
import { ok } from '../lib/http';
import { parse, uuidSchema } from '../lib/validate';
import { requireAuth, userOf } from '../middleware/auth';
import { extractLimiter } from '../middleware/rate-limit';
import { calculateBodySchema, extractFieldsSchema, itemsBodySchema } from './schemas';
import * as service from './estimates.service';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => (ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(badRequest('Only JPEG, PNG or WebP images are allowed'))),
});

export function estimatesRouter(deps: service.Deps): Router {
  const r = Router();
  r.use(requireAuth);

  r.post('/projects/:id/estimates/extract', extractLimiter, upload.single('image'), async (req, res) => {
    const projectId = parse(uuidSchema, req.params.id);
    const fields = parse(extractFieldsSchema, req.body ?? {});
    ok(res, await service.extractFromPhoto(deps, userOf(req).id, projectId, req.file, fields), 201);
  });

  r.get('/estimates/:id', async (req, res) => {
    ok(res, await service.getEstimate(userOf(req).id, parse(uuidSchema, req.params.id)));
  });

  r.put('/estimates/:id/items', async (req, res) => {
    const body = parse(itemsBodySchema, req.body);
    ok(res, await service.replaceItems(userOf(req).id, parse(uuidSchema, req.params.id), body.items));
  });

  r.post('/estimates/:id/calculate', async (req, res) => {
    const body = parse(calculateBodySchema, req.body);
    ok(res, await service.calculateEstimate(userOf(req).id, parse(uuidSchema, req.params.id), body), 201);
  });

  r.post('/estimates/:id/confirm', async (req, res) => {
    ok(res, await service.confirmEstimate(userOf(req).id, parse(uuidSchema, req.params.id)), 201);
  });

  return r;
}
