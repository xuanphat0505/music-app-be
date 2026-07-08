import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Lớp JwtAuthGuard là bộ bảo vệ ngăn chặn truy cập ẩn danh vào các API được chỉ định bảo mật
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
