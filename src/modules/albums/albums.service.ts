import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Album } from './schemas/album.schema';

@Injectable()
export class AlbumsService {
  constructor(
    @InjectModel(Album.name) private readonly albumModel: Model<Album>,
  ) {}

  // Lấy danh sách album có phân trang và hỗ trợ tìm kiếm theo tiêu đề album
  async findAll(q?: string, page = '1', limit = '10') {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const query: any = {};
    if (q) {
      query.title = { $regex: new RegExp(q, 'i') };
    }

    const [albums, total] = await Promise.all([
      this.albumModel
        .find(query)
        .sort({ title: 1 })
        .skip(skip)
        .limit(limitNum)
        .populate('artist')
        .exec(),
      this.albumModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
      data: albums,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    };
  }

  // Lấy chi tiết album kèm theo danh sách bài hát bên trong (Populate)
  async findOne(id: string) {
    let album;
    if (Types.ObjectId.isValid(id)) {
      album = await this.albumModel
        .findById(id)
        .populate('artist')
        .populate({
          path: 'songs',
          populate: { path: 'artist' },
        })
        .exec();
    } else {
      album = await this.albumModel
        .findOne({ audiusId: id })
        .populate('artist')
        .populate({
          path: 'songs',
          populate: { path: 'artist' },
        })
        .exec();
    }

    if (!album) {
      throw new NotFoundException('Không tìm thấy album nhạc yêu cầu.');
    }
    return album;
  }
}
