import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SyncModule } from './modules/sync/sync.module';
import { SongsModule } from './modules/songs/songs.module';
import { ArtistsModule } from './modules/artists/artists.module';
import { AlbumsModule } from './modules/albums/albums.module';
import { PlaylistsModule } from './modules/playlists/playlists.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { HistoryModule } from './modules/history/history.module';

@Module({
  imports: [
    // nạp biến môi trường từ tệp .env toàn cục
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // kết nối db mongodb
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
    }),
    AuthModule,
    UsersModule,
    SyncModule,
    SongsModule,
    ArtistsModule,
    AlbumsModule,
    PlaylistsModule,
    FavoritesModule,
    HistoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
