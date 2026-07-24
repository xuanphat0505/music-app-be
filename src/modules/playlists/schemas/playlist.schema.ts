import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '@/modules/users/schemas/user.schema';
import { Song } from '@/modules/songs/schemas/song.schema';

// Schema lưu trữ thông tin danh sách phát cá nhân của người dùng
@Schema({ timestamps: true, collection: 'playlists' })
export class Playlist extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId | User;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '', trim: true })
  description: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Song' }], default: [] })
  songs: (Types.ObjectId | Song)[];

  @Prop({ type: [String], default: [] })
  coverUrls: string[];
}

export const PlaylistSchema = SchemaFactory.createForClass(Playlist);
export type PlaylistDocument = Playlist & Document;
