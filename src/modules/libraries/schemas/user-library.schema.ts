import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '@/modules/users/schemas/user.schema';
import { Song } from '@/modules/songs/schemas/song.schema';

// Schema lưu vết các bài hát được người dùng thêm vào thư viện cá nhân
@Schema({ timestamps: true, collection: 'user_libraries' })
export class UserLibrary extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId | User;

  @Prop({ type: Types.ObjectId, ref: 'Song', required: true, index: true })
  song: Types.ObjectId | Song;
}

export const UserLibrarySchema = SchemaFactory.createForClass(UserLibrary);
UserLibrarySchema.index({ user: 1, song: 1 }, { unique: true });
export type UserLibraryDocument = UserLibrary & Document;
