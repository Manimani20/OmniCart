import { Module } from '@nestjs/common';
import { resolveSrv } from 'node:dns/promises';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const configuredUri = configService.getOrThrow<string>('MONGODB_URI');

        if (!configuredUri.startsWith('mongodb+srv://')) {
          return { uri: configuredUri };
        }

        const parsedUri = new URL(configuredUri);
        const [record] = await resolveSrv(`_mongodb._tcp.${parsedUri.hostname}`);

        parsedUri.protocol = 'mongodb:';
        parsedUri.hostname = record.name;
        parsedUri.port = String(record.port);

        return { uri: parsedUri.toString() };
      },
    }),
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
