import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

// Lớp LoginDto định nghĩa các quy tắc kiểm tra dữ liệu đầu vào khi đăng nhập tài khoản
export class LoginDto {
  @IsEmail({}, { message: 'Định dạng Email không hợp lệ.' })
  @IsNotEmpty({ message: 'Email không được để trống.' })
  email: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống.' })
  @MinLength(8, { message: 'Mật khẩu phải chứa ít nhất 8 ký tự.' })
  password: string;
}
