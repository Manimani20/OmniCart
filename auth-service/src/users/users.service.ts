import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash +refreshTokenHash')
      .exec();
  }

  async findById(userId: string) {
  return this.userModel
    .findById(userId)
    .select('-passwordHash -refreshTokenHash')
    .lean();
}

  async createUser(
    name: string,
    email: string,
    passwordHash: string,
  ): Promise<UserDocument> {
    const user = new this.userModel({
      name,
      email: email.toLowerCase(),
      passwordHash,
    });

    return user.save();
  }

  async updateRefreshTokenHash(
    userId: string,
    refreshTokenHash: string,
  ): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      refreshTokenHash,
    });
  }

  async clearRefreshTokenHash(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $set: {
        refreshTokenHash: null,
      },
    });
  }

  async findByIdWithRefreshToken(userId: string) {
  return this.userModel
    .findById(userId)
    .select('+refreshTokenHash');
}
}