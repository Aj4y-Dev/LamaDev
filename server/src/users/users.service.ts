import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }
  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }
  create(data: { email: string; passwordHash: string }): Promise<User> {
    return this.repo.save(this.repo.create(data));
  }
}
