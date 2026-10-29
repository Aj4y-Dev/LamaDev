import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types';
import { CreateProjectDto } from './dto/create-project.dto';
import { Project } from './project.entity';
import { ProjectsService } from './projects.service';

const view = (p: Project) => ({ id: p.id, title: p.title, clientName: p.clientName, createdAt: p.createdAt });

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return view(await this.projects.create(user.id, dto));
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return (await this.projects.list(user.id)).map(view);
  }

  @Get(':id')
  async one(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const p = await this.projects.findOneWithEstimates(user.id, id);
    return {
      ...view(p),
      estimates: p.estimates.map((e) => ({ id: e.id, status: e.status, mode: e.mode, grandTotal: e.grandTotal?.toFixed(2) ?? null, createdAt: e.createdAt })),
    };
  }
}
