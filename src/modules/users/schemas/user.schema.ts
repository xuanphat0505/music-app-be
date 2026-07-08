import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// User Settings Schema
@Schema({ _id: false })
export class Settings {

  @Prop({ type: Boolean, default: false })
  pushNotifications: boolean;

  @Prop({ type: String, enum: ['low', 'medium', 'high'], default: 'medium' })
  quality: string;
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);

// User Schema
@Schema({ timestamps: true })
export class User extends Document {
  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  @Prop({ type: String, required: true, select: false })
  password: string;

  @Prop({ type: String, required: true })
  username: string;

  @Prop({ type: String, default: '' })
  avatar: string;

  @Prop({ type: String, enum: ['user', 'admin'], default: 'user' })
  role: string;

  @Prop({ type: String, default: null, select: false })
  refreshToken: string;

  @Prop({ type: SettingsSchema, default: () => ({}) })
  settings: Settings;
}

export const UserSchema = SchemaFactory.createForClass(User);
