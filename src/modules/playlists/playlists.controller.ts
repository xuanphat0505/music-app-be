import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PlaylistsService } from './playlists.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { AddSongDto } from './dto/add-song.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { ResponseMessage } from '@/common/decorators/response-message.decorator';

@UseGuards(JwtAuthGuard)
@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  // Route tạo mới danh sách phát cho người dùng hiện tại
  @Post()
  @ResponseMessage('Tạo danh sách phát thành công.')
  async createPlaylist(@Req() req: any, @Body() dto: CreatePlaylistDto) {
    const userId = req.user._id.toString();
    return this.playlistsService.createPlaylist(userId, dto);
  }

  // Route lấy tất cả danh sách phát của người dùng hiện tại
  @Get()
  @ResponseMessage('Lấy danh sách phát người dùng thành công.')
  async getUserPlaylists(@Req() req: any) {
    const userId = req.user._id.toString();
    return this.playlistsService.getUserPlaylists(userId);
  }

  // Route lấy thông tin chi tiết một danh sách phát theo ID
  @Get(':id')
  @ResponseMessage('Lấy chi tiết danh sách phát thành công.')
  async getPlaylistById(@Req() req: any, @Param('id') id: string) {
    const userId = req.user._id.toString();
    return this.playlistsService.getPlaylistById(id, userId);
  }

  // Route thêm một bài hát mới vào danh sách phát
  @Post(':id/songs')
  @ResponseMessage('Đã thêm bài hát vào danh sách phát.')
  async addSongToPlaylist(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AddSongDto,
  ) {
    const userId = req.user._id.toString();
    return this.playlistsService.addSongToPlaylist(id, userId, dto.songId);
  }

  // Route xóa một bài hát khỏi danh sách phát
  @Delete(':id/songs/:songId')
  @ResponseMessage('Đã xóa bài hát khỏi danh sách phát.')
  async removeSongFromPlaylist(
    @Req() req: any,
    @Param('id') id: string,
    @Param('songId') songId: string,
  ) {
    const userId = req.user._id.toString();
    return this.playlistsService.removeSongFromPlaylist(id, userId, songId);
  }

  // Route cập nhật thông tin tên và mô tả của danh sách phát
  @Patch(':id')
  @ResponseMessage('Cập nhật danh sách phát thành công.')
  async updatePlaylist(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdatePlaylistDto,
  ) {
    const userId = req.user._id.toString();
    return this.playlistsService.updatePlaylist(id, userId, dto);
  }

  // Route xóa một danh sách phát của người dùng
  @Delete(':id')
  @ResponseMessage('Xóa danh sách phát thành công.')
  async deletePlaylist(@Req() req: any, @Param('id') id: string) {
    const userId = req.user._id.toString();
    return this.playlistsService.deletePlaylist(id, userId);
  }
}
