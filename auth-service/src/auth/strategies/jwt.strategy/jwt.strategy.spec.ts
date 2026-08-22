import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('uses the configured access secret', () => {
    const configService = {
      get: jest.fn().mockReturnValue('access-secret'),
    } as unknown as ConfigService;

    expect(new JwtStrategy(configService)).toBeDefined();
    expect(configService.get).toHaveBeenCalledWith('JWT_ACCESS_SECRET');
  });

  it('maps JWT claims to the authenticated request user', () => {
    const configService = {
      get: jest.fn().mockReturnValue('access-secret'),
    } as unknown as ConfigService;
    const strategy = new JwtStrategy(configService);

    expect(strategy.validate({ sub: 'user-1', role: 'CUSTOMER' })).toEqual({
      userId: 'user-1',
      role: 'CUSTOMER',
    });
  });
});
