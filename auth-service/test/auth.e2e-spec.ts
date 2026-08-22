import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy/jwt.strategy';
import { UsersService } from '../src/users/users.service';

const user = {
  _id: { toString: () => 'user-1' },
  name: 'Jane Doe',
  email: 'jane@example.com',
  passwordHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOQ5QZ1JxQhL4f1iJfJwL7j7z7V7V7V7V7',
  role: 'CUSTOMER',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('Auth HTTP API (e2e)', () => {
  let app: INestApplication<App>;
  const usersService = {
    findByEmail: jest.fn(),
    createUser: jest.fn(),
    findById: jest.fn(),
    findByIdWithRefreshToken: jest.fn(),
    updateRefreshTokenHash: jest.fn(),
    clearRefreshTokenHash: jest.fn(),
  };

  beforeAll(async () => {
    user.passwordHash = await bcrypt.hash('Password@123', 4);
    const configService = {
      get: jest.fn(
        (key: string) =>
          ({
            JWT_ACCESS_SECRET: 'access-secret',
            JWT_ACCESS_EXPIRATION: '15m',
            JWT_REFRESH_SECRET: 'refresh-secret',
            JWT_REFRESH_EXPIRATION: '7d',
            NODE_ENV: 'test',
          })[key],
      ),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: 'access-secret',
          signOptions: { expiresIn: '15m' },
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        { provide: UsersService, useValue: usersService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usersService.createUser.mockResolvedValue(user);
    usersService.findById.mockResolvedValue({ ...user, _id: 'user-1' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a user and validates the request body', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'J', email: 'invalid', password: 'weak' })
      .expect(400);

    usersService.findByEmail.mockResolvedValue(null);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'Password@123',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.user).toEqual(
          expect.objectContaining({ id: 'user-1', email: user.email }),
        );
        expect(body.user.passwordHash).toBeUndefined();
      });
  });

  it('logs in, refreshes with the cookie, and accesses /auth/me', async () => {
    usersService.findByEmail.mockResolvedValue(user);
    const agent = request.agent(app.getHttpServer());

    const loginResponse = await agent
      .post('/auth/login')
      .send({ email: user.email, password: 'Password@123' })
      .expect(201);
    expect(loginResponse.body.accessToken).toEqual(expect.any(String));
    expect(loginResponse.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('refreshToken=')]),
    );

    await agent
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual(expect.objectContaining({ id: 'user-1' })),
      );

    const refreshToken = loginResponse.headers['set-cookie'][0]
      .split(';')[0]
      .split('=')[1];
    usersService.findByIdWithRefreshToken.mockResolvedValue({
      ...user,
      refreshTokenHash: await bcrypt.hash(refreshToken, 4),
    });
    await agent
      .post('/auth/refresh')
      .expect(201)
      .expect(({ body }) =>
        expect(body.accessToken).toEqual(expect.any(String)),
      );
  });

  it('protects /auth/me and logout with the JWT guard', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer()).post('/auth/logout').expect(401);
  });
});
