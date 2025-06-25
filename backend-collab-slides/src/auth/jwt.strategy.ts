import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'supersecret',
    });
  }


  

  async validate(payload: any) {
    console.log('🔍 JWT Payload recibido:', payload);
    
    // El payload tiene: { sub: user.id, email: user.email, planId: user.planId }
    const user = { 
      userId: payload.sub,  // ← Mapear 'sub' a 'userId'
      id: payload.sub,      // ← También disponible como 'id'
      email: payload.email,
      planId: payload.planId
    };
    
    console.log('🔍 Usuario retornado por validate:', user);
    return user;
  }
}