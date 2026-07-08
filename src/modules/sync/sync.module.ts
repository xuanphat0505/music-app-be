import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { ArtistsModule } from '@/modules/artists/artists.module';
import { SongsModule } from '@/modules/songs/songs.module';
import { AlbumsModule } from '@/modules/albums/albums.module';

@Module({
  imports: [
    ArtistsModule,
    SongsModule,
    AlbumsModule,
  ],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
