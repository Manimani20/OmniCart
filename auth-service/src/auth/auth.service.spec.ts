import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = {
    findByEmail: jest.fn(),
    createUser: jest.fn(),
    findById: jest.fn(),
    findByIdWithRefreshToken: jest.fn(),
    updateRefreshTokenHash: jest.fn(),
    clearRefreshTokenHash: jest.fn(),
  };
  const jwtService = { signAsync: jest.fn(), verifyAsync: jest.fn() };
  const configService = { get: jest.fn() };
  const response = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('registers a new user and never returns the password hash', async () => {
    const user = {
      _id: { toString: () => 'user-1' },
      name: 'Jane Doe',
      email: 'jane@example.com',
      role: 'CUSTOMER',
      createdAt: new Date(),
    };
    usersService.findByEmail.mockResolvedValue(null);
    usersService.createUser.mockResolvedValue(user);
    (bcrypt.hash as jest.Mock).mockResolvedValue('password-hash');

    await expect(
      service.register({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'Password@123',
      }),
    ).resolves.toEqual({
      message: 'User registered successfully',
      user: {
        id: 'user-1',
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
    expect(usersService.createUser).toHaveBeenCalledWith(
      'Jane Doe',
      'jane@example.com',
      'password-hash',
    );
  });

  it('rejects registration when the email already exists', async () => {
    usersService.findByEmail.mockResolvedValue({});

    await expect(
      service.register({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'Password@123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in, stores the refresh hash, and sets the cookie', async () => {
    const user = {
      _id: { toString: () => 'user-1' },
      passwordHash: 'hash',
      role: 'CUSTOMER',
    };
    usersService.findByEmail.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('refresh-hash');
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    configService.get.mockImplementation(
      (key: string) =>
        ({
          JWT_REFRESH_SECRET: 'refresh-secret',
          JWT_REFRESH_EXPIRATION: '7d',
          NODE_ENV: 'test',
        })[key],
    );

    await expect(
      service.login(
        { email: 'jane@example.com', password: 'Password@123' },
        response,
      ),
    ).resolves.toEqual({ accessToken: 'access-token' });
    expect(usersService.updateRefreshTokenHash).toHaveBeenCalledWith(
      'user-1',
      'refresh-hash',
    );
    expect(response.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'refresh-token',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it.each([
    ['missing user', null, 'compare'],
    ['wrong password', { passwordHash: 'hash' }, 'compare'],
  ])('rejects login for %s', async (_case, user, _operation) => {
    usersService.findByEmail.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login(
        { email: 'jane@example.com', password: 'bad-password' },
        response,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid refresh token before querying the user', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

    await expect(service.refresh('bad-token', response)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersService.findByIdWithRefreshToken).not.toHaveBeenCalled();
  });

  it('rotates a valid refresh token', async () => {
    const user = {
      _id: { toString: () => 'user-1' },
      role: 'CUSTOMER',
      refreshTokenHash: 'hash',
    };
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      role: 'CUSTOMER',
    });
    usersService.findByIdWithRefreshToken.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
    jwtService.signAsync
      .mockResolvedValueOnce('new-access')
      .mockResolvedValueOnce('new-refresh');
    configService.get.mockReturnValue('7d');

    await expect(service.refresh('old-refresh', response)).resolves.toEqual({
      accessToken: 'new-access',
    });
    expect(usersService.updateRefreshTokenHash).toHaveBeenCalledWith(
      'user-1',
      'new-hash',
    );
  });

  it('gets a user and logs out', async () => {
    const user = {
      _id: 'user-1',
      name: 'Jane',
      email: 'jane@example.com',
      role: 'CUSTOMER',
      createdAt: new Date(),
    };
    usersService.findById.mockResolvedValue(user);
    await expect(service.getMe('user-1')).resolves.toEqual({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });
    await expect(service.logout('user-1', response)).resolves.toEqual({
      message: 'Logged out successfully',
    });
    expect(usersService.clearRefreshTokenHash).toHaveBeenCalledWith('user-1');
    expect(response.clearCookie).toHaveBeenCalledWith(
      'refreshToken',
      expect.objectContaining({ httpOnly: true }),
    );
  });
});
