import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Res,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { SongsService } from './songs.service';
import { GetSongsFilterDto } from './dto/get-songs-filter.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { ResponseMessage } from '@/common/decorators/response-message.decorator';
import axios from 'axios';

@UseGuards(JwtAuthGuard)
@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  // Lấy danh sách bài hát có phân trang, tìm kiếm và lọc theo thể loại
  @Get()
  @ResponseMessage('Lấy danh sách bài hát thành công.')
  async getSongs(@Query() filterDto: GetSongsFilterDto) {
    return this.songsService.findAll(filterDto);
  }

  // Lấy danh sách bài hát đang thịnh hành (Trending)
  @Get('trending')
  @ResponseMessage('Lấy danh sách bài hát thịnh hành thành công.')
  async getTrendingSongs(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.songsService.findTrending(limitNum);
  }

  // Lấy danh sách thể loại nhạc kèm theo số lượng bài hát
  @Get('genres')
  @ResponseMessage('Lấy danh sách thể loại nhạc thành công.')
  async getGenres() {
    return this.songsService.getGenresCount();
  }

  // Lấy chi tiết bài hát theo ID hoặc spotifyId
  @Get(':id')
  @ResponseMessage('Lấy thông tin chi tiết bài hát thành công.')
  async getSongDetail(@Param('id') id: string) {
    return this.songsService.findOne(id);
  }

  // Lấy lời bài hát theo ID hoặc spotifyId
  @Get(':id/lyrics')
  @ResponseMessage('Lấy lời bài hát thành công.')
  async getSongLyrics(@Param('id') id: string) {
    return this.songsService.getLyrics(id);
  }

  // Tăng lượt nghe của bài hát khi phát nhạc
  @UseGuards(JwtAuthGuard)
  @Post(':id/play')
  @ResponseMessage('Ghi nhận lượt nghe bài hát thành công.')
  async playSong(@Param('id') id: string) {
    return this.songsService.incrementPlays(id);
  }

  // Tuyến đường redirect trung gian (stream proxy) tự động định tuyến tới máy chủ stream YouTube khả dụng nhất qua Invidious API
  @Get('stream/:id')
  async streamSong(@Param('id') youtubeVideoId: string, @Res() res: any) {
    const invidiousInstances = [
      'https://invidious.f5.si',
      'https://invidious.tiekoetter.com',
      'https://invidious.nerdvpn.de',
      'https://inv.nadeko.net',
      'https://yewtu.be',
    ];

    // Thử danh sách các Invidious instance có sẵn
    for (const instance of invidiousInstances) {
      try {
        const streamUrl = `${instance}/latest_version?id=${youtubeVideoId}&itag=140&local=true`;
        // Kiểm tra xem instance này có đang hoạt động tốt bằng cách gửi request HEAD nhanh
        const response = await axios.head(streamUrl, { timeout: 2500 });
        if (response.status === 200 || response.status === 206) {
          return res.redirect(streamUrl);
        }
      } catch {
        // Bỏ qua lỗi và thử instance tiếp theo
      }
    }

    // Fallback: Lấy động danh sách instance từ api.invidious.io nếu toàn bộ danh sách tĩnh bị lỗi
    try {
      const instancesRes = await axios.get('https://api.invidious.io/instances.json', { timeout: 3000 });
      const instances = instancesRes.data || [];
      const dynamicInstances = instances
        .filter(([_, meta]) => meta.type === 'https' && meta.uri)
        .map(([_, meta]) => meta.uri)
        .slice(0, 10);

      for (const instance of dynamicInstances) {
        try {
          const streamUrl = `${instance}/latest_version?id=${youtubeVideoId}&itag=140&local=true`;
          const response = await axios.head(streamUrl, { timeout: 2500 });
          if (response.status === 200 || response.status === 206) {
            return res.redirect(streamUrl);
          }
        } catch {
          // Bỏ qua lỗi
        }
      }
    } catch {
      // Bỏ qua lỗi lấy dữ liệu động
    }

    throw new NotFoundException('Không thể tải luồng phát nhạc từ YouTube.');
  }
}
