import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RESPONSE_MESSAGE } from '../decorators/response-message.decorator';

export interface Response<T> {
  statusCode: number;
  message: string;
  data: T;
}

// Lớp TransformInterceptor tự động chuyển đổi định dạng phản hồi thành công trả về từ các API
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  constructor(private readonly reflector: Reflector) {}

  // Phương thức intercept chặn và tái định dạng lại cấu trúc đầu ra theo chuẩn thống nhất
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const response = context.switchToHttp().getResponse();
    const statusCode = response.statusCode;
    const message = this.reflector.get<string>(RESPONSE_MESSAGE, context.getHandler()) || 'Thao tác thành công';

    return next.handle().pipe(
      map((data) => ({
        statusCode,
        message,
        data,
      })),
    );
  }
}
