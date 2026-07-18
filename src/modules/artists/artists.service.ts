import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Artist } from '@/modules/artists/schemas/artist.schema';
import { Song, SongDocument } from '@/modules/songs/schemas/song.schema';

@Injectable()
export class ArtistsService {
  constructor(
    @InjectModel(Artist.name) private readonly artistModel: Model<Artist>,
    @InjectModel(Song.name) private readonly songModel: Model<SongDocument>,
  ) {}

  // Lấy danh sách nghệ sĩ có phân trang và hỗ trợ tìm kiếm theo tên hoặc username
  async findAll(q?: string, page = '1', limit = '10') {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const query: any = {};
    if (q) {
      const searchRegex = new RegExp(q, 'i');
      query.$or = [{ name: searchRegex }, { username: searchRegex }];
    }

    const [artists, total] = await Promise.all([
      this.artistModel
        .find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .exec(),
      this.artistModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
      data: artists,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    };
  }

  // Lấy chi tiết nghệ sĩ theo ID hoặc spotifyId
  async findOne(id: string) {
    let artist;
    if (Types.ObjectId.isValid(id)) {
      artist = await this.artistModel.findById(id).exec();
    } else {
      artist = await this.artistModel.findOne({ spotifyId: id }).exec();
    }

    if (!artist) {
      throw new NotFoundException('Không tìm thấy nghệ sĩ yêu cầu.');
    }
    return artist;
  }

  // Lấy danh sách bài hát thuộc về nghệ sĩ có phân trang
  async findSongsByArtist(artistId: string, page = '1', limit = '10') {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Tìm nghệ sĩ trước để đảm bảo nghệ sĩ tồn tại và lấy đúng ObjectId
    const artist = await this.findOne(artistId);

    const query = { artist: artist._id };

    const [songs, total] = await Promise.all([
      this.songModel
        .find(query)
        .sort({ createdAt: -1 })
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
}
