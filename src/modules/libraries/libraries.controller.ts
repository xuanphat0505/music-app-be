import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { LibrariesService } from './libraries.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { ResponseMessage } from '@/common/decorators/response-message.decorator';

@UseGuards(JwtAuthGuard)
@Controller('libraries')
export class LibrariesController {
  constructor(private readonly librariesService: LibrariesService) {}

  // Bật hoặc tắt trạng thái lưu bài hát trong thư viện cá nhân
  @Post('toggle/:songId')
  @ResponseMessage('Cập nhật trạng thái bài hát trong thư viện thành công.')
  async toggleSongInLibrary(@Req() req: any, @Param('songId') songId: string) {
    const userId = req.user._id.toString();
    return this.librariesService.toggleSongInLibrary(userId, songId);
  }

  // Lấy danh sách các bài hát đã thêm vào thư viện cá nhân có phân trang
  @Get('songs')
  @ResponseMessage('Lấy danh sách bài hát trong thư viện thành công.')
  async getUserLibrarySongs(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user._id.toString();
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.librariesService.getUserLibrarySongs(userId, pageNum, limitNum);
  }

  // Lấy toàn bộ danh sách ID bài hát có trong thư viện của người dùng
  @Get('ids')
  @ResponseMessage('Lấy danh sách ID bài hát trong thư viện thành công.')
  async getUserLibrarySongIds(@Req() req: any) {
    const userId = req.user._id.toString();
    return this.librariesService.getUserLibrarySongIds(userId);
  }
}
