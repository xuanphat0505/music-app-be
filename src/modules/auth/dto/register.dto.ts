import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';

// định nghĩa các quy tắc kiểm tra dữ liệu đầu vào khi đăng ký tài khoản
export class RegisterDto {
  @IsEmail({}, { message: 'Định dạng Email không hợp lệ.' })
  @IsNotEmpty({ message: 'Email không được để trống.' })
  email: string;

  @IsString({ message: 'Tên người dùng phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Tên người dùng không được để trống.' })
  username: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống.' })
  @MinLength(8, { message: 'Mật khẩu phải chứa ít nhất 8 ký tự.' })
  @Matches(/[!@#$%^&*(),.?":{}|<>]/, {
    message: 'Mật khẩu phải chứa ít nhất một ký tự đặc biệt.',
  })
  @Matches(/\d/, { message: 'Mật khẩu phải chứa ít nhất một số.' })
  password: string;
}
