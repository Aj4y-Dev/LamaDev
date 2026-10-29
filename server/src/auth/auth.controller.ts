import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CredentialsDto } from './dto/auth.dto';

@Controller('auth')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: CredentialsDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: CredentialsDto) {
    return this.auth.login(dto);
  }
}
