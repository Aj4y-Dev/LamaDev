import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProjectDto } from './dto/create-project.dto';
import { Project } from './project.entity';

@Injectable()
export class ProjectsService {
  constructor(@InjectRepository(Project) private readonly repo: Repository<Project>) {}

  create(userId: string, dto: CreateProjectDto): Promise<Project> {
    return this.repo.save(this.repo.create({ userId, title: dto.title.trim(), clientName: dto.clientName?.trim() || null }));
  }

  list(userId: string): Promise<Project[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  /** Other users' projects look like they do not exist. */
  async findOwnedOrFail(userId: string, id: string): Promise<Project> {
    const p = await this.repo.findOne({ where: { id, userId } });
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Project not found' });
    return p;
  }

  async findOneWithEstimates(userId: string, id: string): Promise<Project> {
    const p = await this.repo.findOne({ where: { id, userId }, relations: { estimates: true }, order: { estimates: { createdAt: 'DESC' } } });
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Project not found' });
    return p;
  }
}
