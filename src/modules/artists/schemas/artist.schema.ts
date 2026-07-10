import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// Schema lưu thông tin chi tiết của nghệ sĩ/ca sĩ được đồng bộ từ Audius
@Schema({ timestamps: true })
export class Artist extends Document {
  @Prop({ type: String, required: true, unique: true, index: true })
  audiusId: string;

  @Prop({ type: String, required: true })
  username: string;

  @Prop({ type: String, required: true, index: true })
  name: string;

  @Prop({ type: String, default: '' })
  avatar: string;

  @Prop({ type: String, default: '' })
  bio: string;

  @Prop({ type: Number, default: 0 })
  followerCount: number;
}

export const ArtistSchema = SchemaFactory.createForClass(Artist);
