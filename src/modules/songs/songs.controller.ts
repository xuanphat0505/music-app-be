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
  @Post(':id/play')
  @ResponseMessage('Ghi nhận lượt nghe bài hát thành công.')
  async playSong(@Param('id') id: string) {
    return this.songsService.incrementPlays(id);
  }

  // Tuyến đường redirect trung gian (stream proxy) tự động định tuyến tới máy chủ stream YouTube khả dụng nhất qua Piped API
  @Get('stream/:id')
  async streamSong(@Param('id') youtubeVideoId: string, @Res() res: any) {
    const pipedInstances = [
      'https://pipedapi.kavin.rocks',
      'https://api.piped.yt',
      'https://piped-api.lunar.icu',
      'https://pipedapi.col1a.de',
    ];

    for (const instance of pipedInstances) {
      try {
        const response = await axios.get(
          `${instance}/streams/${youtubeVideoId}`,
          { timeout: 4000 },
        );
        const audioStreams = response.data?.audioStreams || [];
        const bestStream = audioStreams.reduce((prev, current) => {
          return (prev.bitrate || 0) > (current.bitrate || 0) ? prev : current;
        }, audioStreams[0]);

        if (bestStream && bestStream.url) {
          return res.redirect(bestStream.url);
        }
      } catch {
        // Bỏ qua lỗi và tiếp tục thử với instance tiếp theo
      }
    }

    throw new NotFoundException('Không thể tải luồng phát nhạc từ YouTube.');
  }
}
