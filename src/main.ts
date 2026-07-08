import { NestFactory, Reflector } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Hàm bootstrap cấu hình khởi chạy các thông số ban đầu của máy chủ NestJS
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cấu hình cho phép Cors kết nối từ ứng dụng client bên ngoài
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'ngrok-skip-browser-warning',
    ],
    credentials: true,
  });

  // Đăng ký bộ chuyển đổi và kiểm soát dữ liệu biểu mẫu đầu vào toàn cục
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  // Đăng ký bộ lọc chuyển đổi phản hồi dữ liệu thành công toàn cục
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new TransformInterceptor(reflector));

  // Đăng ký bộ kiểm soát và xử lý ngoại lệ lỗi toàn cục
  app.useGlobalFilters(new HttpExceptionFilter());

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  await app.listen(port);
  Logger.log(`Server is running on: http://localhost:${port}`);
}
bootstrap();
