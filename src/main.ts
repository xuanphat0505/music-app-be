import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

// Hàm bootstrap cấu hình khởi chạy các thông số ban đầu của máy chủ NestJS
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cấu hình cho phép Cors kết nối từ ứng dụng client bên ngoài
  app.enableCors();

  // Đăng ký bộ chuyển đổi và kiểm soát dữ liệu biểu mẫu đầu vào toàn cục
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  await app.listen(port);
}
bootstrap();
