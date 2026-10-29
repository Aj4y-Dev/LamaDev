import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { EstimateItem } from './estimates/estimate-item.entity';
import { Estimate } from './estimates/estimate.entity';
import { Project } from './projects/project.entity';
import { User } from './users/user.entity';

/** Used by the TypeORM CLI for migrations: pnpm migration:generate src/migrations/Init */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, Project, Estimate, EstimateItem],
  migrations: ['src/migrations/*.ts'],
});
