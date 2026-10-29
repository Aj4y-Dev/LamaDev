import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { CredentialsDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersService, private readonly jwt: JwtService) {}

  async register(dto: CredentialsDto) {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'An account with this email already exists' });
    }
    const user = await this.users.create({ email: dto.email, passwordHash: await hash(dto.password, 10) });
    return this.issue(user);
  }

  async login(dto: CredentialsDto) {
    const user = await this.users.findByEmail(dto.email);
    const ok = user?.passwordHash ? await compare(dto.password, user.passwordHash) : false;
    if (!user || !ok) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Wrong email or password' });
    }
    return this.issue(user);
  }

  private issue(user: User) {
    const token = this.jwt.sign({ sub: user.id, email: user.email });
    return { token, user: { id: user.id, email: user.email } };
  }
}
