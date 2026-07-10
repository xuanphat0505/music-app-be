import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AlbumsService } from './albums.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { ResponseMessage } from '@/common/decorators/response-message.decorator';

@UseGuards(JwtAuthGuard)
@Controller('albums')
export class AlbumsController {
  constructor(private readonly albumsService: AlbumsService) {}

  // Lấy danh sách các album có phân trang và hỗ trợ lọc tìm kiếm
  @Get()
  @ResponseMessage('Lấy danh sách album thành công.')
  async getAlbums(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.albumsService.findAll(q, page, limit);
  }

  // Lấy chi tiết album nhạc theo ID
  @Get(':id')
  @ResponseMessage('Lấy chi tiết album thành công.')
  async getAlbumDetail(@Param('id') id: string) {
    return this.albumsService.findOne(id);
  }
}
