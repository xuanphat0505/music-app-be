import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ArtistsService } from '@/modules/artists/artists.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { ResponseMessage } from '@/common/decorators/response-message.decorator';

@UseGuards(JwtAuthGuard)
@Controller('artists')
export class ArtistsController {
  constructor(private readonly artistsService: ArtistsService) {}

  // Lấy danh sách nghệ sĩ có phân trang và hỗ trợ tìm kiếm từ khóa
  @Get()
  @ResponseMessage('Lấy danh sách nghệ sĩ thành công.')
  async getArtists(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.artistsService.findAll(q, page, limit);
  }

  // Lấy thông tin chi tiết của nghệ sĩ theo ID hoặc audiusId
  @Get(':id')
  @ResponseMessage('Lấy chi tiết nghệ sĩ thành công.')
  async getArtistDetail(@Param('id') id: string) {
    return this.artistsService.findOne(id);
  }

  // Lấy toàn bộ danh sách các bài hát thuộc nghệ sĩ theo ID
  @Get(':id/songs')
  @ResponseMessage('Lấy danh sách bài hát của nghệ sĩ thành công.')
  async getArtistSongs(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.artistsService.findSongsByArtist(id, page, limit);
  }
}
