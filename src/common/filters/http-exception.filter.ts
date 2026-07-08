import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Lớp HttpExceptionFilter kiểm soát và chuẩn hóa mọi phản hồi lỗi xảy ra trong ứng dụng
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  // Phương thức catch bắt giữ ngoại lệ và định dạng cấu trúc JSON thông báo lỗi
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse: any = exception.getResponse();

    // Xác định thông báo lỗi chính xác kể cả khi có danh sách lỗi xác thực class-validator
    let message =
      exceptionResponse.message || exception.message || 'Có lỗi xảy ra.';
    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    }

    const error = exceptionResponse.error || 'Internal Server Error';

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
