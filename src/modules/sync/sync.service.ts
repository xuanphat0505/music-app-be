import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { Artist } from '@/modules/artists/schemas/artist.schema';
import { Song } from '@/modules/songs/schemas/song.schema';
import { Album } from '@/modules/albums/schemas/album.schema';
import { getHealthyNode } from '@/common/utils/audius';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectModel(Artist.name) private readonly artistModel: Model<Artist>,
    @InjectModel(Song.name) private readonly songModel: Model<Song>,
    @InjectModel(Album.name) private readonly albumModel: Model<Album>,
  ) {}

  // Tìm kiếm hoặc làm mới API Node khả dụng có tốc độ phản hồi tốt từ mạng lưới Audius
  async getHealthyNode(): Promise<string> {
    return getHealthyNode();
  }

  // Thực hiện đồng bộ danh sách bài hát đang thịnh hành về cơ sở dữ liệu MongoDB
  async syncTrendingTracks(limit = 50, offset = 0): Promise<boolean> {
    try {
      const nodeUrl = await this.getHealthyNode();
      this.logger.log(`Bắt đầu tải nhạc thịnh hành từ: ${nodeUrl} (limit: ${limit}, offset: ${offset})`);

      const response = await axios.get(`${nodeUrl}/v1/tracks/trending`, {
        params: {
          limit,
          offset,
          app_name: 'musichub',
        },
        timeout: 15000,
      });

      const tracks = response.data?.data;
      if (!tracks || tracks.length === 0) {
        this.logger.warn('Không lấy được bài hát nào từ Audius.');
        return false;
      }

      this.logger.log(
        `Tải thành công ${tracks.length} bài hát. Bắt đầu lưu trữ vào MongoDB...`,
      );

      for (const track of tracks) {
        // 1. Đồng bộ và lưu thông tin Nghệ sĩ/Ca sĩ trước để lấy ObjectId
        const artistUser = track.user;
        if (!artistUser) continue;

        const artistDoc = await this.artistModel.findOneAndUpdate(
          { audiusId: artistUser.id },
          {
            username: artistUser.handle,
            name: artistUser.name || artistUser.handle,
            avatar: artistUser.profile_picture
              ? artistUser.profile_picture['150x150']
              : '',
            bio: artistUser.bio || '',
            followerCount: artistUser.follower_count || 0,
          },
          { returnDocument: 'after', upsert: true },
        );

        // 2. Đồng bộ thông tin bài hát
        const artworkUrl = track.artwork
          ? track.artwork['480x480'] || track.artwork['150x150'] || ''
          : '';

        await this.songModel.findOneAndUpdate(
          { audiusId: track.id },
          {
            title: track.title,
            duration: Math.round(track.duration || 0),
            artwork: artworkUrl,
            genre: track.genre || 'Other',
            audiusPlaysCount: track.play_count || 0,
            artist: artistDoc._id,
            streamUrl: `/songs/stream/${track.id}`, // Đường dẫn stream nội bộ qua backend proxy
          },
          { upsert: true },
        );
      }

      this.logger.log('Đã hoàn thành đồng bộ cơ sở dữ liệu nhạc thành công!');
      return true;
    } catch (error: any) {
      this.logger.error(`Lỗi trong quá trình đồng bộ nhạc: ${error.message}`);
      return false;
    }
  }

  // Thực hiện đồng bộ danh sách Album đang thịnh hành kèm toàn bộ bài hát trong đó về MongoDB
  async syncTrendingAlbums(limit = 10, offset = 0): Promise<boolean> {
    try {
      const nodeUrl = await this.getHealthyNode();
      this.logger.log(`Bắt đầu tải Album thịnh hành từ: ${nodeUrl} (limit: ${limit}, offset: ${offset})`);

      const response = await axios.get(`${nodeUrl}/v1/playlists/trending`, {
        params: {
          limit,
          offset,
          type: 'album',
          app_name: 'musichub',
        },
        timeout: 15000,
      });

      const albums = response.data?.data;
      if (!albums || albums.length === 0) {
        this.logger.warn('Không lấy được Album nào từ Audius.');
        return false;
      }

      this.logger.log(
        `Tải thành công ${albums.length} Album. Bắt đầu lưu trữ vào MongoDB...`,
      );

      for (const albumData of albums) {
        // 1. Đồng bộ và lưu thông tin Nghệ sĩ sở hữu Album trước
        const artistUser = albumData.user;
        if (!artistUser) continue;

        const artistDoc = await this.artistModel.findOneAndUpdate(
          { audiusId: artistUser.id },
          {
            username: artistUser.handle,
            name: artistUser.name || artistUser.handle,
            avatar: artistUser.profile_picture
              ? artistUser.profile_picture['150x150']
              : '',
            bio: artistUser.bio || '',
            followerCount: artistUser.follower_count || 0,
          },
          { returnDocument: 'after', upsert: true },
        );

        // 2. Đồng bộ thông tin Album (lưu trước để lấy ID liên kết cho bài hát)
        const artworkUrl = albumData.artwork
          ? albumData.artwork['480x480'] || albumData.artwork['150x150'] || ''
          : '';

        const albumDoc = await this.albumModel.findOneAndUpdate(
          { audiusId: albumData.id },
          {
            title: albumData.playlist_name,
            artwork: artworkUrl,
            artist: artistDoc._id,
          },
          { returnDocument: 'after', upsert: true },
        );

        const songIds: any[] = [];

        // 3. Đồng bộ danh sách bài hát thuộc Album này
        const tracks = albumData.tracks || [];
        for (const track of tracks) {
          const songArtworkUrl = track.artwork
            ? track.artwork['480x480'] || track.artwork['150x150'] || ''
            : artworkUrl;

          const songDoc = await this.songModel.findOneAndUpdate(
            { audiusId: track.id },
            {
              title: track.title,
              duration: Math.round(track.duration || 0),
              artwork: songArtworkUrl,
              genre: track.genre || 'Other',
              audiusPlaysCount: track.play_count || 0,
              artist: artistDoc._id,
              album: albumDoc._id, // Liên kết khoá ngoại tới Album
              streamUrl: `/songs/stream/${track.id}`,
            },
            { returnDocument: 'after', upsert: true },
          );

          if (songDoc) {
            songIds.push(songDoc._id);
          }
        }

        // 4. Lưu danh sách bài hát ngược lại vào Album
        albumDoc.songs = songIds;
        await albumDoc.save();
      }

      this.logger.log('Đã hoàn thành đồng bộ danh sách Album thành công!');
      return true;
    } catch (error: any) {
      this.logger.error(`Lỗi trong quá trình đồng bộ Album: ${error.message}`);
      return false;
    }
  }
}
