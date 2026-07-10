import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SongsController } from '@/modules/songs/songs.controller';
import { SongsService } from '@/modules/songs/songs.service';
import { Song, SongSchema } from '@/modules/songs/schemas/song.schema';
import { ArtistsModule } from '@/modules/artists/artists.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Song.name, schema: SongSchema }]),
    ArtistsModule,
  ],
  controllers: [SongsController],
  providers: [SongsService],
  exports: [MongooseModule, SongsService],
})
export class SongsModule {}
