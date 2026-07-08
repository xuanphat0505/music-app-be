import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ArtistsController } from './artists.controller';
import { ArtistsService } from './artists.service';
import { Artist, ArtistSchema } from './schemas/artist.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Artist.name, schema: ArtistSchema }]),
  ],
  controllers: [ArtistsController],
  providers: [ArtistsService],
  exports: [MongooseModule, ArtistsService],
})
export class ArtistsModule {}
