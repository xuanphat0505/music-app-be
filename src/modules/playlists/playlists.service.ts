import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Playlist, PlaylistDocument } from './schemas/playlist.schema';
import { Song, SongDocument } from '@/modules/songs/schemas/song.schema';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';

@Injectable()
export class PlaylistsService {
  constructor(
    @InjectModel(Playlist.name)
    private readonly playlistModel: Model<PlaylistDocument>,
    @InjectModel(Song.name)
    private readonly songModel: Model<SongDocument>,
  ) {}

  // Tạo mới danh sách phát cá nhân cho người dùng
  async createPlaylist(userId: string, dto: CreatePlaylistDto) {
    const playlist = await this.playlistModel.create({
      user: new Types.ObjectId(userId),
      title: dto.title.trim(),
      description: dto.description?.trim() || '',
      songs: [],
      coverUrls: [],
    });
    return playlist;
  }

  // Lấy toàn bộ danh sách phát do người dùng tạo kèm thông tin cơ bản
  async getUserPlaylists(userId: string) {
    const playlists = await this.playlistModel
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .populate({
        path: 'songs',
        select: '_id title artwork duration',
      })
      .exec();
    return playlists;
  }

  // Lấy thông tin chi tiết một danh sách phát kèm dữ liệu đầy đủ các bài hát và ca sĩ
  async getPlaylistById(playlistId: string, userId: string) {
    if (!Types.ObjectId.isValid(playlistId)) {
      throw new BadRequestException('Mã danh sách phát không hợp lệ.');
    }
    const playlist = await this.playlistModel
      .findById(playlistId)
      .populate({
        path: 'songs',
        populate: { path: 'artists', select: '_id name avatar spotifyId' },
      })
      .exec();

    if (!playlist) {
      throw new NotFoundException('Không tìm thấy danh sách phát.');
    }
    const ownerId = (playlist.user as any).toString();
    if (ownerId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập danh sách phát này.',
      );
    }
    return playlist;
  }

  // Thêm một bài hát mới vào danh sách phát đã chọn
  async addSongToPlaylist(playlistId: string, userId: string, songId: string) {
    if (
      !Types.ObjectId.isValid(playlistId) ||
      !Types.ObjectId.isValid(songId)
    ) {
      throw new BadRequestException('Mã không hợp lệ.');
    }

    const [playlist, song] = await Promise.all([
      this.playlistModel.findById(playlistId),
      this.songModel.findById(songId),
    ]);

    if (!playlist) {
      throw new NotFoundException('Không tìm thấy danh sách phát.');
    }
    const ownerId = (playlist.user as any).toString();
    if (ownerId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa danh sách phát này.',
      );
    }
    if (!song) {
      throw new NotFoundException('Không tìm thấy bài hát.');
    }

    const songObjId = new Types.ObjectId(songId);
    const exists = playlist.songs.some(
      (id: any) => (id._id || id).toString() === songId,
    );
    if (exists) {
      throw new BadRequestException(
        'Bài hát đã tồn tại trong danh sách phát này.',
      );
    }

    playlist.songs.push(songObjId);

    // Cập nhật lại mảng coverUrls từ 4 bài hát đầu tiên
    const populated = await playlist.populate({
      path: 'songs',
      select: 'artwork',
    });
    const songCovers = (populated.songs as any[])
      .map((item) => item.artwork)
      .filter((url) => Boolean(url) && typeof url === 'string')
      .slice(0, 4);

    playlist.coverUrls = songCovers;
    await playlist.save();

    return playlist;
  }

  // Xóa bài hát khỏi danh sách phát
  async removeSongFromPlaylist(
    playlistId: string,
    userId: string,
    songId: string,
  ) {
    if (
      !Types.ObjectId.isValid(playlistId) ||
      !Types.ObjectId.isValid(songId)
    ) {
      throw new BadRequestException('Mã không hợp lệ.');
    }

    const playlist = await this.playlistModel.findById(playlistId);
    if (!playlist) {
      throw new NotFoundException('Không tìm thấy danh sách phát.');
    }
    const ownerId = (playlist.user as any).toString();
    if (ownerId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa danh sách phát này.',
      );
    }

    playlist.songs = playlist.songs.filter(
      (id: any) => (id._id || id).toString() !== songId,
    );

    const populated = await playlist.populate({
      path: 'songs',
      select: 'artwork',
    });
    const songCovers = (populated.songs as any[])
      .map((item) => item.artwork)
      .filter((url) => Boolean(url) && typeof url === 'string')
      .slice(0, 4);

    playlist.coverUrls = songCovers;
    await playlist.save();

    return playlist;
  }

  // Xóa hoàn toàn danh sách phát của người dùng
  async deletePlaylist(playlistId: string, userId: string) {
    if (!Types.ObjectId.isValid(playlistId)) {
      throw new BadRequestException('Mã danh sách phát không hợp lệ.');
    }
    const playlist = await this.playlistModel.findById(playlistId);
    if (!playlist) {
      throw new NotFoundException('Không tìm thấy danh sách phát.');
    }
    const ownerId = (playlist.user as any).toString();
    if (ownerId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền xóa danh sách phát này.',
      );
    }

    await this.playlistModel.findByIdAndDelete(playlistId);
    return { message: 'Đã xóa danh sách phát thành công.' };
  }

  // Cập nhật thông tin tiêu đề và mô tả danh sách phát
  async updatePlaylist(
    playlistId: string,
    userId: string,
    dto: UpdatePlaylistDto,
  ) {
    if (!Types.ObjectId.isValid(playlistId)) {
      throw new BadRequestException('Mã danh sách phát không hợp lệ.');
    }
    const playlist = await this.playlistModel.findById(playlistId);
    if (!playlist) {
      throw new NotFoundException('Không tìm thấy danh sách phát.');
    }
    const ownerId = (playlist.user as any).toString();
    if (ownerId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa danh sách phát này.',
      );
    }

    if (dto.title !== undefined) playlist.title = dto.title.trim();
    if (dto.description !== undefined)
      playlist.description = dto.description.trim();

    await playlist.save();
    return playlist;
  }
}
