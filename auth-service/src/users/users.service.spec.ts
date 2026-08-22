import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  const model = {
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: 'UserModel', useValue: model }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('finds an email with password and refresh hash selected', async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({}),
    };
    model.findOne.mockReturnValue(query);
    await service.findByEmail('JANE@EXAMPLE.COM');
    expect(model.findOne).toHaveBeenCalledWith({ email: 'jane@example.com' });
    expect(query.select).toHaveBeenCalledWith(
      '+passwordHash +refreshTokenHash',
    );
  });

  it('finds a user by id without secret fields', async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({}),
    };
    model.findById.mockReturnValue(query);
    await service.findById('user-1');
    expect(query.select).toHaveBeenCalledWith(
      '-passwordHash -refreshTokenHash',
    );
  });

  it('creates users with normalized email', async () => {
    const save = jest.fn().mockResolvedValue({});
    const constructor = jest.fn().mockImplementation(() => ({ save }));
    Object.setPrototypeOf(model, constructor.prototype);
    const serviceWithConstructor = new UsersService(constructor as any);
    await serviceWithConstructor.createUser('Jane', 'JANE@EXAMPLE.COM', 'hash');
    expect(constructor).toHaveBeenCalledWith({
      name: 'Jane',
      email: 'jane@example.com',
      passwordHash: 'hash',
    });
  });

  it('updates and clears refresh token hashes', async () => {
    model.findByIdAndUpdate.mockResolvedValue({});
    await service.updateRefreshTokenHash('user-1', 'hash');
    await service.clearRefreshTokenHash('user-1');
    expect(model.findByIdAndUpdate).toHaveBeenNthCalledWith(1, 'user-1', {
      refreshTokenHash: 'hash',
    });
    expect(model.findByIdAndUpdate).toHaveBeenNthCalledWith(2, 'user-1', {
      $set: { refreshTokenHash: null },
    });
  });
});
