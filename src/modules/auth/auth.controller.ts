import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { ResponseMessage } from '@/common/decorators/response-message.decorator';

// Lớp AuthController định nghĩa các tuyến API tiếp nhận yêu cầu xác thực tài khoản từ client
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // Đăng ký tài khoản người dùng mới
  @Post('register')
  @ResponseMessage('Đăng ký tài khoản thành công.')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // Đăng nhập hệ thống và cấp phát cặp token
  @Post('login')
  @ResponseMessage('Đăng nhập thành công.')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // Làm mới Access Token khi phiên đăng nhập hết hạn bằng cách giải mã Refresh Token
  @Post('refresh')
  @ResponseMessage('Làm mới token thành công.')
  async refresh(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token không được để trống.');
    }
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          'musichub_refresh_secret_key_456!',
      });
      return this.authService.refreshTokens(payload.sub, refreshToken);
    } catch {
      throw new ForbiddenException(
        'Refresh token không hợp lệ hoặc đã hết hạn.',
      );
    }
  }

  // Đăng xuất tài khoản và vô hiệu hóa Refresh Token hiện tại
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ResponseMessage('Đăng xuất thành công.')
  async logout(@Req() req: any) {
    const userId = req.user._id.toString();
    return this.authService.logout(userId);
  }

  // Lấy thông tin chi tiết tài khoản của người dùng đang đăng nhập
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ResponseMessage('Lấy thông tin tài khoản thành công.')
  getProfile(@Req() req: any) {
    return req.user;
  }
}
