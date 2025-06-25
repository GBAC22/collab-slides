import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService
  ) {}

   async validateUser(email: string, pass: string) {
    const user = await this.userService.findByEmail(email);
    if (user && user.password && await bcrypt.compare(pass, user.password)) {
      // No devolvemos el password
      const { password, ...result } = user;
      return result;
    }
    throw new UnauthorizedException('Invalid credentials');
  }

async login(user: any) {
  console.log('Generando token para:', user);
  const payload = { sub: user.id, email: user.email, planId: user.planId };
  return {
    access_token: this.jwtService.sign(payload),
  };
}


  async register(createUserDto: CreateUserDto) {
    const existing = await this.userService.findByEmail(createUserDto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const user = await this.userService.create(createUserDto);
    return this.login(user);
  }

 getUserIdFromToken(token: string): string {
    try {
      const payload = this.jwtService.decode(token) as { sub: string };
      if (!payload || !payload.sub) {
        throw new UnauthorizedException('Token inválido o sin ID');
      }
      return payload.sub;
    } catch (err) {
      throw new UnauthorizedException('Token inválido');
    }
  }
}
