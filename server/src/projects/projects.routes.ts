import { Router } from 'express';
import { z } from 'zod';
import { pool, rows, one } from '../db';
import { notFound } from '../lib/errors';
import { ok } from '../lib/http';
import { parse, uuidSchema } from '../lib/validate';
import { requireAuth, userOf } from '../middleware/auth';

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  clientName: z.string().trim().max(200).optional(),
}).strict();

interface ProjectRow { id: string; title: string; client_name: string | null; created_at: Date }
const view = (p: ProjectRow) => ({ id: p.id, title: p.title, clientName: p.client_name, createdAt: p.created_at });

/** Other users' projects look like they do not exist. */
export async function assertProjectOwned(userId: string, projectId: string): Promise<ProjectRow> {
  const p = await one<ProjectRow>(pool, 'select * from projects where id = $1 and user_id = $2', [projectId, userId]);
  if (!p) throw notFound('Project not found');
  return p;
}

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.post('/', async (req, res) => {
  const body = parse(createSchema, req.body);
  const p = await one<ProjectRow>(pool, 'insert into projects (user_id, title, client_name) values ($1, $2, $3) returning *', [userOf(req).id, body.title, body.clientName || null]);
  ok(res, view(p as ProjectRow), 201);
});

projectsRouter.get('/', async (req, res) => {
  const list = await rows<ProjectRow>(pool, 'select * from projects where user_id = $1 order by created_at desc', [userOf(req).id]);
  ok(res, list.map(view));
});

projectsRouter.get('/:id', async (req, res) => {
  const id = parse(uuidSchema, req.params.id);
  const p = await assertProjectOwned(userOf(req).id, id);
  const estimates = await rows<{ id: string; status: string; mode: string; grand_total: string | null; created_at: Date }>(
    pool, 'select id, status, mode, grand_total, created_at from estimates where project_id = $1 order by created_at desc', [id],
  );
  ok(res, { ...view(p), estimates: estimates.map((e) => ({ id: e.id, status: e.status, mode: e.mode, grandTotal: e.grand_total, createdAt: e.created_at })) });
});
