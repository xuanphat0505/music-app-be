import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LibrariesController } from './libraries.controller';
import { LibrariesService } from './libraries.service';
import {
  UserLibrary,
  UserLibrarySchema,
} from './schemas/user-library.schema';
import { Song, SongSchema } from '@/modules/songs/schemas/song.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserLibrary.name, schema: UserLibrarySchema },
      { name: Song.name, schema: SongSchema },
    ]),
  ],
  controllers: [LibrariesController],
  providers: [LibrariesService],
  exports: [LibrariesService],
})
export class LibrariesModule {}
