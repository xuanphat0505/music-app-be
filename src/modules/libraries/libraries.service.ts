import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  UserLibrary,
  UserLibraryDocument,
} from './schemas/user-library.schema';
import { Song, SongDocument } from '@/modules/songs/schemas/song.schema';

@Injectable()
export class LibrariesService {
  constructor(
    @InjectModel(UserLibrary.name)
    private readonly userLibraryModel: Model<UserLibraryDocument>,
    @InjectModel(Song.name)
    private readonly songModel: Model<SongDocument>,
  ) {}

  // Thêm hoặc xóa một bài hát khỏi thư viện cá nhân của người dùng
  async toggleSongInLibrary(userId: string, songId: string) {
    const song = await this.songModel.findById(songId);
    if (!song) {
      throw new NotFoundException('Không tìm thấy bài hát.');
    }

    const userObjId = new Types.ObjectId(userId);
    const songObjId = new Types.ObjectId(songId);

    // Xóa nguyên tử nếu bài hát đã tồn tại trong thư viện
    const deleted = await this.userLibraryModel.findOneAndDelete({
      user: userObjId,
      song: songObjId,
    });

    if (deleted) {
      return { isAdded: false, message: 'Đã xóa bài hát khỏi thư viện.' };
    }

    // Nếu chưa có, tiến hành thêm mới
    try {
      await this.userLibraryModel.create({
        user: userObjId,
        song: songObjId,
      });
      return {
        isAdded: true,
        message: 'Đã thêm bài hát vào thư viện thành công.',
      };
    } catch (err: any) {
      if (err?.code === 11000) {
        return {
          isAdded: true,
          message: 'Bài hát đã có trong thư viện.',
        };
      }
      throw err;
    }
  }

  // Lấy danh sách các bài hát trong thư viện cá nhân kèm thông tin chi tiết bài hát và ca sĩ
  async getUserLibrarySongs(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.userLibraryModel
        .find({ user: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'song',
          populate: { path: 'artists', select: '_id name avatar spotifyId' },
        })
        .exec(),
      this.userLibraryModel.countDocuments({
        user: new Types.ObjectId(userId),
      }),
    ]);

    const songs = items.map((item: any) => item.song).filter(Boolean);

    return {
      data: songs,
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // Trả về danh sách chuỗi ID các bài hát đã thêm vào thư viện cá nhân của người dùng
  async getUserLibrarySongIds(userId: string): Promise<string[]> {
    const items = await this.userLibraryModel
      .find({ user: new Types.ObjectId(userId) })
      .select('song')
      .exec();

    return items.map((item: any) => item.song.toString());
  }
}
