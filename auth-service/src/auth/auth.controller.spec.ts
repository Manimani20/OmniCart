import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard/jwt-auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    getMe: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('delegates registration', async () => {
    const dto = {
      name: 'Jane',
      email: 'jane@example.com',
      password: 'Password@123',
    };
    authService.register.mockResolvedValue({ ok: true });
    await expect(controller.register(dto)).resolves.toEqual({ ok: true });
    expect(authService.register).toHaveBeenCalledWith(dto);
  });

  it('passes the response to login and refresh', async () => {
    const dto = { email: 'jane@example.com', password: 'Password@123' };
    const response = {} as any;
    const request = { cookies: { refreshToken: 'refresh-token' } } as any;
    authService.login.mockResolvedValue({ accessToken: 'access' });
    authService.refresh.mockResolvedValue({ accessToken: 'new-access' });

    await controller.login(dto, response);
    await controller.refresh(request, response);

    expect(authService.login).toHaveBeenCalledWith(dto, response);
    expect(authService.refresh).toHaveBeenCalledWith('refresh-token', response);
  });

  it('returns profile and logs out using the authenticated user', async () => {
    const request = { user: { userId: 'user-1', role: 'CUSTOMER' } } as any;
    const response = {} as any;
    authService.getMe.mockResolvedValue({ id: 'user-1' });
    authService.logout.mockResolvedValue({
      message: 'Logged out successfully',
    });

    await expect(controller.getMe(request)).resolves.toEqual({ id: 'user-1' });
    await expect(controller.logout(request, response)).resolves.toEqual({
      message: 'Logged out successfully',
    });
    expect(authService.getMe).toHaveBeenCalledWith('user-1');
    expect(authService.logout).toHaveBeenCalledWith('user-1', response);
  });

  it('uses the JWT guard on protected endpoints', () => {
    const meGuards = Reflect.getMetadata(
      '__guards__',
      AuthController.prototype.getMe,
    );
    const logoutGuards = Reflect.getMetadata(
      '__guards__',
      AuthController.prototype.logout,
    );
    expect(meGuards).toContain(JwtAuthGuard);
    expect(logoutGuards).toContain(JwtAuthGuard);
  });
});
