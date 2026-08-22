import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { SignOptions } from 'jsonwebtoken';
import { JwtStrategy } from './strategies/jwt.strategy/jwt.strategy';
import { RolesGuard } from './guards/roles/roles.guard';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.get<SignOptions['expiresIn']>(
            'JWT_ACCESS_EXPIRATION',
          ),
        },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, RolesGuard,],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
