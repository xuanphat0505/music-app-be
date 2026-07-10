import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SongsService } from './songs.service';
import { GetSongsFilterDto } from './dto/get-songs-filter.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { ResponseMessage } from '@/common/decorators/response-message.decorator';
import { getHealthyNode } from '../../common/utils/audius';

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

  // Lấy chi tiết bài hát theo ID hoặc audiusId
  @Get(':id')
  @ResponseMessage('Lấy thông tin chi tiết bài hát thành công.')
  async getSongDetail(@Param('id') id: string) {
    return this.songsService.findOne(id);
  }

  // Tăng lượt nghe của bài hát khi phát nhạc
  @Post(':id/play')
  @ResponseMessage('Ghi nhận lượt nghe bài hát thành công.')
  async playSong(@Param('id') id: string) {
    return this.songsService.incrementPlays(id);
  }

  // Tuyến đường redirect trung gian (stream proxy) tự động định tuyến tới máy chủ nhạc Audius tối ưu nhất
  @Get('stream/:id')
  async streamSong(@Param('id') audiusId: string, @Res() res: any) {
    const node = await getHealthyNode();
    // Redirect 302 tạm thời sang đường dẫn stream nhạc trực tiếp từ Audius
    return res.redirect(
      `${node}/v1/tracks/${audiusId}/stream?app_name=musichub`,
    );
  }
}
