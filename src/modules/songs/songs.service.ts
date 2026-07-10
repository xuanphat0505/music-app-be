import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Song, SongDocument } from './schemas/song.schema';
import { Artist } from '@/modules/artists/schemas/artist.schema';
import { GetSongsFilterDto } from './dto/get-songs-filter.dto';

// Lớp SongsService quản lý logic nghiệp vụ liên quan đến truy xuất, tìm kiếm, tăng lượt phát nhạc
@Injectable()
export class SongsService {
  constructor(
    @InjectModel(Song.name) private readonly songModel: Model<SongDocument>,
    @InjectModel(Artist.name) private readonly artistModel: Model<Artist>,
  ) {}

  // Lấy danh sách bài hát có phân trang, lọc theo thể loại và tìm kiếm từ khóa
  async findAll(filterDto: GetSongsFilterDto) {
    const { page = '1', limit = '10', genre, q, sort } = filterDto;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const query: any = {};

    // Bộ lọc thể loại nhạc
    if (genre) {
      query.genre = { $regex: new RegExp(`^${genre}$`, 'i') };
    }

    // Bộ lọc từ khóa tìm kiếm (Tên bài hát hoặc tên ca sĩ)
    if (q) {
      const searchRegex = new RegExp(q, 'i');
      
      // Bước 1: Tìm tất cả nghệ sĩ khớp từ khóa để lấy danh sách IDs của họ
      const matchedArtists = await this.artistModel
        .find({ name: searchRegex })
        .select('_id')
        .exec();
      const artistIds = matchedArtists.map((a) => a._id);

      // Bước 2: Tạo query tìm kiếm bài hát khớp tên HOẶC thuộc nghệ sĩ khớp tên
      query.$or = [
        { title: searchRegex },
        { artist: { $in: artistIds } },
      ];
    }

    // Xử lý tiêu chí sắp xếp
    let sortOption: any = { createdAt: -1 }; // Mặc định bài hát mới nhất
    if (sort === 'playsCount') {
      sortOption = { playsCount: -1 };
    } else if (sort === 'title') {
      sortOption = { title: 1 };
    }

    // Thực hiện truy vấn song song để tăng hiệu năng
    const [songs, total] = await Promise.all([
      this.songModel
        .find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .populate('artist')
        .populate('album')
        .exec(),
      this.songModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
      data: songs,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    };
  }

  // Lấy các bài hát thịnh hành nhất dựa theo lượt nghe playsCount hoặc audiusPlaysCount
  async findTrending(limit = 10) {
    return this.songModel
      .find()
      .sort({ playsCount: -1, audiusPlaysCount: -1 })
      .limit(limit)
      .populate('artist')
      .populate('album')
      .exec();
  }

  // Lấy danh sách tổng hợp số lượng bài hát theo từng thể loại nhạc
  async getGenresCount() {
    return this.songModel.aggregate([
      {
        $group: {
          _id: '$genre',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          genre: '$_id',
          count: 1,
          _id: 0,
        },
      },
      {
        $sort: { count: -1 },
      },
    ]).exec();
  }

  // Tìm chi tiết một bài hát theo ID hoặc audiusId
  async findOne(id: string) {
    let song;
    if (Types.ObjectId.isValid(id)) {
      song = await this.songModel
        .findById(id)
        .populate('artist')
        .populate('album')
        .exec();
    } else {
      song = await this.songModel
        .findOne({ audiusId: id })
        .populate('artist')
        .populate('album')
        .exec();
    }

    if (!song) {
      throw new NotFoundException('Không tìm thấy bài hát yêu cầu.');
    }
    return song;
  }

  // Tăng lượt nghe của bài hát khi phát nhạc
  async incrementPlays(id: string) {
    let song;
    if (Types.ObjectId.isValid(id)) {
      song = await this.songModel
        .findByIdAndUpdate(id, { $inc: { playsCount: 1 } }, { new: true })
        .populate('artist')
        .populate('album')
        .exec();
    } else {
      song = await this.songModel
        .findOneAndUpdate(
          { audiusId: id },
          { $inc: { playsCount: 1 } },
          { new: true },
        )
        .populate('artist')
        .populate('album')
        .exec();
    }

    if (!song) {
      throw new NotFoundException('Không tìm thấy bài hát yêu cầu để tăng lượt nghe.');
    }
    return song;
  }
}
