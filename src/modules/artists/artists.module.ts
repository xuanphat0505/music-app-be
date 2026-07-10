import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ArtistsController } from '@/modules/artists/artists.controller';
import { ArtistsService } from '@/modules/artists/artists.service';
import { Artist, ArtistSchema } from '@/modules/artists/schemas/artist.schema';
import { Song, SongSchema } from '@/modules/songs/schemas/song.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Artist.name, schema: ArtistSchema },
      { name: Song.name, schema: SongSchema },
    ]),
  ],
  controllers: [ArtistsController],
  providers: [ArtistsService],
  exports: [MongooseModule, ArtistsService],
})
export class ArtistsModule {}
