import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { Artist } from '@/modules/artists/schemas/artist.schema';
import { Song } from '@/modules/songs/schemas/song.schema';
import { Album } from '@/modules/albums/schemas/album.schema';

const POPULAR_ARTISTS = [
  'Ed Sheeran',
  'The Weeknd',
  'Justin Bieber',
  'Bruno Mars',
  'Maroon 5',
  'One Direction',
  'Charlie Puth',
  'Avicii',
  'Alan Walker',
  'The Chainsmokers',
  'Son Tung M-TP',
  'Den Vau',
  'Hoang Thuy Linh',
  'Vu.',
  'Da LAB',
  'Amee',
  'Jack - J97',
  'Binz',
  'Soobin Hoang Son',
  'JustaTee',
  'tlinh',
  'MCK',
  'Grey D',
  'MONO',
  'MIN',
  'ERIK',
  'Duc Phuc',
  'Phan Manh Quynh',
  'My Tam',
  'Ha Anh Tuan',
  'B Ray',
  'Thieu Bao Tram',
  'HIEUTHUHAI',
  'Wren Evans',
  'Obito',
  'Wxrdie',
];

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectModel(Artist.name) private readonly artistModel: Model<Artist>,
    @InjectModel(Song.name) private readonly songModel: Model<Song>,
    @InjectModel(Album.name) private readonly albumModel: Model<Album>,
  ) {}

  // Làm sạch chuỗi văn bản bằng cách loại bỏ các ký tự đặc biệt để tối ưu hóa tìm kiếm
  private cleanText(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/gi, '')
      .toLowerCase()
      .trim();
  }

  // Tìm kiếm đệ quy các đối tượng videoRenderer trong phản hồi JSON từ YouTube
  private findVideoRenderers(obj: any, results: any[] = []): any[] {
    if (!obj || typeof obj !== 'object') return results;

    if (obj.videoRenderer) {
      results.push(obj.videoRenderer);
    }

    for (const key of Object.keys(obj)) {
      try {
        this.findVideoRenderers(obj[key], results);
      } catch {
        // Bỏ qua lỗi truy cập thuộc tính
      }
    }

    return results;
  }

  // Tìm kiếm video ID của bài hát trên YouTube dựa theo tên bài hát, ca sĩ và thời lượng
  private async findYoutubeVideoId(
    trackName: string,
    artistName: string,
    durationSec: number,
  ): Promise<string> {
    const query = `${trackName} ${artistName} audio`;
    const url = 'https://www.youtube.com/results';

    try {
      const response = await axios.get(url, {
        params: { search_query: query },
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        timeout: 10000,
      });

      const html = response.data;
      const match = html.match(/var ytInitialData = ({[\s\S]*?});/);
      if (!match) return '';

      const jsonStr = match[1];
      const data = JSON.parse(jsonStr);
      const renderers = this.findVideoRenderers(data);
      if (renderers.length === 0) return '';

      let bestVideoId = '';
      let lowestPenalty = Infinity;

      for (const video of renderers) {
        if (!video.videoId || !video.title || !video.lengthText) continue;

        const videoTitle = (
          video.title.runs?.[0]?.text ||
          video.title.simpleText ||
          ''
        ).toLowerCase();
        const durationText =
          video.lengthText.runs?.[0]?.text || video.lengthText.simpleText || '';

        let videoDuration = 0;
        const timeParts = durationText.split(':').map(Number);
        if (timeParts.length === 2) {
          videoDuration = timeParts[0] * 60 + timeParts[1];
        } else if (timeParts.length === 3) {
          videoDuration =
            timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
        }

        const durationDiff = Math.abs(videoDuration - durationSec);
        let penalty = durationDiff * 2;

        if (durationDiff > 15) {
          penalty += 100;
        }

        const cleanTitle = videoTitle.toLowerCase();
        if (
          cleanTitle.includes('karaoke') ||
          cleanTitle.includes('instrumental') ||
          cleanTitle.includes('beat')
        ) {
          penalty += 200;
        }

        if (cleanTitle.includes('cover') || cleanTitle.includes('remix')) {
          penalty += 150;
        }

        if (cleanTitle.includes('audio') || cleanTitle.includes('lyric')) {
          penalty -= 30;
        }

        if (penalty < lowestPenalty) {
          lowestPenalty = penalty;
          bestVideoId = video.videoId;
        }
      }

      return bestVideoId || renderers[0].videoId;
    } catch (error: any) {
      this.logger.error(
        `Lỗi khi tìm kiếm trực tiếp trên YouTube cho "${query}": ${error.message}`,
      );
      return '';
    }
  }

  // Đồng bộ danh sách bài hát hiện đại bằng cách quét qua danh sách nghệ sĩ phổ biến
  async syncTrendingTracks(limit = 100, offset = 0): Promise<boolean> {
    try {
      const currentCount = await this.songModel.countDocuments();
      this.logger.log(
        `Số lượng bài hát hiện có trong database: ${currentCount} bài. Bắt đầu từ offset: ${offset}`,
      );

      if (currentCount >= limit) {
        this.logger.log(
          `Đã đạt hoặc vượt mục tiêu ${limit} bài hát. Dừng tiến trình.`,
        );
        return true;
      }

      let savedCount = currentCount;
      const targetCount = limit;

      this.logger.log(
        `Bắt đầu cào tiếp nhạc xu hướng hiện đại (Mục tiêu: ${targetCount} bài)`,
      );

      for (const artistName of POPULAR_ARTISTS) {
        if (savedCount >= targetCount) break;
        if (!artistName) continue;

        this.logger.log(`Đang cào nghệ sĩ: ${artistName}`);

        let itunesTracks: any[] = [];
        try {
          const itunesRes = await axios.get('https://itunes.apple.com/search', {
            params: {
              term: artistName,
              limit: 15,
              entity: 'song',
            },
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            timeout: 10000,
          });
          itunesTracks = itunesRes.data?.results || [];
        } catch (itunesErr: any) {
          this.logger.error(
            `Lỗi tìm kiếm nghệ sĩ trên iTunes: ${itunesErr.message}`,
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }

        this.logger.log(`Tìm thấy ${itunesTracks.length} bài hát từ iTunes.`);

        for (const track of itunesTracks) {
          if (savedCount >= targetCount) break;

          const trackName = track.trackName;
          const artistFullName = track.artistName;
          const durationSec = Math.round((track.trackTimeMillis || 0) / 1000);
          const releaseYear = track.releaseDate
            ? new Date(track.releaseDate).getFullYear()
            : 0;

          if (releaseYear && releaseYear < 2018) {
            continue;
          }

          const pseudoSpotifyTrackId = `track_${track.trackId}`;
          const existingSong = await this.songModel.findOne({
            spotifyId: pseudoSpotifyTrackId,
          });
          if (existingSong) {
            this.logger.log(
              `Bài hát "${trackName}" đã tồn tại trong cơ sở dữ liệu. Bỏ qua.`,
            );
            continue;
          }

          this.logger.log(
            `Đang xử lý: "${trackName}" - "${artistFullName}" (${releaseYear})`,
          );

          let lyricsData: any = null;
          try {
            const lrcRes = await axios.get('https://lrclib.net/api/get', {
              params: {
                artist_name: artistFullName,
                track_name: trackName,
                duration: durationSec,
              },
              headers: {
                'User-Agent':
                  'MusicHubCrawler/1.0.0 (https://github.com/admin/music-app)',
              },
              timeout: 8000,
            });
            if (
              lrcRes.data &&
              (lrcRes.data.plainLyrics || lrcRes.data.syncedLyrics)
            ) {
              lyricsData = {
                lyrics: lrcRes.data.plainLyrics || '',
                syncedLyrics: lrcRes.data.syncedLyrics || '',
              };
            }
          } catch {
            // Chấp nhận và bỏ qua nếu lỗi trực tiếp
          }

          if (!lyricsData) {
            const cleanTitle = this.cleanText(trackName);
            const cleanArtist = this.cleanText(artistFullName);
            try {
              const searchResponse = await axios.get(
                'https://lrclib.net/api/search',
                {
                  params: { track_name: cleanTitle, artist_name: cleanArtist },
                  headers: {
                    'User-Agent':
                      'MusicHubCrawler/1.0.0 (https://github.com/admin/music-app)',
                  },
                  timeout: 8000,
                },
              );
              const results = searchResponse.data || [];
              const bestMatch = results.find(
                (r) => r.plainLyrics || r.syncedLyrics,
              );
              if (bestMatch) {
                lyricsData = {
                  lyrics: bestMatch.plainLyrics || '',
                  syncedLyrics: bestMatch.syncedLyrics || '',
                };
              }
            } catch {
              // Chấp nhận bỏ qua nếu lỗi tìm kiếm
            }
          }

          if (!lyricsData) {
            this.logger.warn(
              `Không tìm thấy lời Karaoke trên LRCLIB cho "${trackName}". Bỏ qua.`,
            );
            continue;
          }

          let youtubeVideoId = '';
          try {
            youtubeVideoId = await this.findYoutubeVideoId(
              trackName,
              artistFullName,
              durationSec,
            );
          } catch (ytErr: any) {
            this.logger.error(
              `Lỗi khi truy vấn luồng âm thanh YouTube: ${ytErr.message}`,
            );
          }

          if (!youtubeVideoId) {
            this.logger.warn(
              `Không tìm thấy mã video stream trên YouTube cho "${trackName}". Bỏ qua.`,
            );
            continue;
          }

          const pseudoSpotifyArtistId = `artist_${String(
            track.artistId || track.artistViewUrl || artistFullName,
          ).replace(/[^a-zA-Z0-9]/g, '')}`;

          const artistDoc = await this.artistModel.findOneAndUpdate(
            { spotifyId: pseudoSpotifyArtistId },
            {
              name: artistFullName,
              avatar: track.artworkUrl100
                ? track.artworkUrl100.replace('100x100bb.jpg', '240x240bb.jpg')
                : '',
              bio: `Nghệ sĩ hiện đại được đồng bộ từ kho nhạc.`,
            },
            { returnDocument: 'after', upsert: true },
          );

          const artworkUrl = track.artworkUrl100
            ? track.artworkUrl100.replace('100x100bb.jpg', '480x480bb.jpg')
            : '';

          await this.songModel.findOneAndUpdate(
            { spotifyId: pseudoSpotifyTrackId },
            {
              youtubeVideoId: youtubeVideoId,
              title: trackName,
              duration: durationSec,
              artwork: artworkUrl,
              genre: track.primaryGenreName || 'Pop',
              artist: artistDoc._id,
              streamUrl: `/songs/stream/${youtubeVideoId}`,
              lyrics: lyricsData.lyrics,
              syncedLyrics: lyricsData.syncedLyrics,
            },
            { upsert: true },
          );

          savedCount++;
          this.logger.log(
            `THÀNH CÔNG [${savedCount}/${targetCount}]: Đã đồng bộ bài hát "${trackName}"`,
          );

          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      this.logger.log('Đã hoàn thành tiến trình cào nhạc thành công!');
      return true;
    } catch (error: any) {
      this.logger.error(
        `Lỗi nghiêm trọng trong quá trình cào nhạc: ${error.message}`,
      );
      return false;
    }
  }

  // Phương thức đồng bộ Album (hiện tại không được hỗ trợ trong kiến trúc mới)
  async syncTrendingAlbums(limit = 10, offset = 0): Promise<boolean> {
    this.logger.warn(
      `Đồng bộ Album không được hỗ trợ trong kiến trúc Spotify/YouTube mới. Giới hạn: ${limit}, Phân trang: ${offset}`,
    );
    await Promise.resolve();
    return true;
  }
}
