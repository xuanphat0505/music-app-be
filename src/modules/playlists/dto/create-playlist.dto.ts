import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// DTO quy định dữ liệu đầu vào khi người dùng tạo mới danh sách phát
export class CreatePlaylistDto {
  @IsNotEmpty({ message: 'Tên danh sách phát không được để trống.' })
  @IsString({ message: 'Tên danh sách phát phải là chuỗi ký tự.' })
  @MaxLength(50, { message: 'Tên danh sách phát tối đa 50 ký tự.' })
  title: string;

  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi ký tự.' })
  @MaxLength(200, { message: 'Mô tả tối đa 200 ký tự.' })
  description?: string;
}
