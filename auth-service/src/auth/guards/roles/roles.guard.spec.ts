import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const guard = new RolesGuard(reflector);
  const request = { user: { role: 'ADMIN' } };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  beforeEach(() => jest.clearAllMocks());

  it('allows endpoints without role metadata', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a user with a required role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['ADMIN']);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies requests without an authenticated user', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['ADMIN']);
    const unauthenticatedContext = {
      ...context,
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(unauthenticatedContext)).toBe(false);
  });

  it('throws when the user has insufficient permissions', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'SUPPORT_AGENT',
    ]);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
