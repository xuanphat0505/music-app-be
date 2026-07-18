import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Artist } from '@/modules/artists/schemas/artist.schema';
import { Song } from '@/modules/songs/schemas/song.schema';

// Định nghĩa lớp Schema lưu thông tin Album nhạc liên kết tập hợp nhiều bài hát
@Schema({ timestamps: true })
export class Album extends Document {
  @Prop({ type: String, unique: true, sparse: true, index: true })
  spotifyId?: string;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, default: '' })
  artwork: string;

  @Prop({ type: Types.ObjectId, ref: 'Artist', required: true, index: true })
  artist: Types.ObjectId | Artist;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Song' }], default: [] })
  songs: Types.ObjectId[] | Song[];
}

export const AlbumSchema = SchemaFactory.createForClass(Album);
