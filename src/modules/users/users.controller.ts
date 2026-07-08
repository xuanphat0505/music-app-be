import { Controller, Put, Body, UseGuards, Req, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResponseMessage } from '@/common/decorators/response-message.decorator';

// Lớp UsersController định nghĩa các tuyến API cập nhật cấu hình hoặc hồ sơ người dùng
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Lấy thông tin cá nhân
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ResponseMessage('Lấy thông tin cá nhân thành công.')
  async getProfile(@Req() req: any) {
    return this.usersService.findById(req.user._id);
  }

  // update hồ sơ cá nhân
  @UseGuards(JwtAuthGuard)
  @Put('profile')
  @ResponseMessage('Cập nhật hồ sơ thành công.')
  async updateProfile(
    @Req() req: any,
    @Body() body: { username?: string; avatar?: string },
  ) {
    const userId = req.user._id.toString();
    return this.usersService.update(userId, body);
  }

  // update settings cá nhân
  @UseGuards(JwtAuthGuard)
  @Put('settings')
  @ResponseMessage('Cập nhật cài đặt thành công.')
  async updateSettings(
    @Req() req: any,
    @Body()
    body: { theme?: string; pushNotifications?: boolean; quality?: string },
  ) {
    const userId = req.user._id.toString();
    const updateData: any = {};
    if (body.theme !== undefined) updateData['settings.theme'] = body.theme;
    if (body.pushNotifications !== undefined)
      updateData['settings.pushNotifications'] = body.pushNotifications;
    if (body.quality !== undefined)
      updateData['settings.quality'] = body.quality;

    return this.usersService.update(userId, updateData);
  }
}
