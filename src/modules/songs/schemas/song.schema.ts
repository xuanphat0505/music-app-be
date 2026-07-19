import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Artist } from '@/modules/artists/schemas/artist.schema';
import { Album } from '@/modules/albums/schemas/album.schema';

// Schema lưu trữ thông tin chi tiết bài hát, liên kết nhạc trực tuyến và ảnh bìa
@Schema({ timestamps: true })
export class Song extends Document {
  @Prop({ type: String, required: true, unique: true, index: true })
  spotifyId: string;

  @Prop({ type: String, default: '', index: true })
  youtubeVideoId: string;

  @Prop({ type: String, required: true, index: true })
  title: string;

  @Prop({ type: Number, required: true })
  duration: number;

  @Prop({ type: String, default: '' })
  artwork: string;

  @Prop({ type: String, default: '', index: true })
  genre: string;

  @Prop({ type: Number, default: 0, index: true })
  playsCount: number;

  @Prop({ type: Number, default: 0 })
  spotifyPlaysCount: number;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Artist' }],
    required: true,
    index: true,
  })
  artists: (Types.ObjectId | Artist)[];

  @Prop({ type: Types.ObjectId, ref: 'Album', default: null, index: true })
  album: Types.ObjectId | Album | null;

  @Prop({ type: String, default: '' })
  streamUrl: string;

  @Prop({ type: String, default: '' })
  lyrics: string;

  @Prop({ type: String, default: '' })
  syncedLyrics: string;
}

export const SongSchema = SchemaFactory.createForClass(Song);
export type SongDocument = Song & Document;
