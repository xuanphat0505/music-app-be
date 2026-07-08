import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from '@/modules/users/schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  // tạo user mới
  async create(userData: Partial<User>): Promise<User> {
    const newUser = new this.userModel(userData);
    return newUser.save();
  }

  // Tìm kiếm thông tin người dùng dựa vào email
  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  // Tìm kiếm thông tin người dùng theo email và lấy kèm mật khẩu bảo mật
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).select('+password').exec();
  }

  // Tìm kiếm người dùng dựa trên id
  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  // Tìm kiếm người dùng theo id và lấy kèm Refresh Token
  async findByIdWithRefreshToken(id: string): Promise<User | null> {
    return this.userModel.findById(id).select('+refreshToken').exec();
  }

  // update thông tin người dùng
  async update(id: string, updateData: Partial<User>): Promise<User | null> {
    return this.userModel
      .findByIdAndUpdate(id, updateData, { returnDocument: 'after' })
      .exec();
  }

  // băm nhỏ và lưu trữ hoặc xóa bỏ Refresh Token của user
  async updateRefreshToken(id: string, refreshToken: string | null): Promise<void> {
    let hashedToken: string | null = null;
    if (refreshToken) {
      hashedToken = await bcrypt.hash(refreshToken, 10);
    }
    await this.userModel.findByIdAndUpdate(id, { refreshToken: hashedToken }).exec();
  }
}
