import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { EstimateItem } from './estimates/estimate-item.entity';
import { Estimate } from './estimates/estimate.entity';
import { EstimatesModule } from './estimates/estimates.module';
import { Project } from './projects/project.entity';
import { ProjectsModule } from './projects/projects.module';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        type: 'postgres' as const,
        url: c.getOrThrow<string>('DATABASE_URL'),
        ssl: c.get<string>('DB_SSL') === 'true',
        entities: [User, Project, Estimate, EstimateItem],
        // Tables are created automatically only in development. Use migrations everywhere else.
        synchronize: c.get<string>('NODE_ENV') === 'development',
        migrations: [__dirname + '/migrations/*.js'],
        migrationsRun: c.get<string>('NODE_ENV') === 'production',
      }),
    }),
    UsersModule,
    AuthModule,
    ProjectsModule,
    EstimatesModule,
  ],
})
export class AppModule {}
