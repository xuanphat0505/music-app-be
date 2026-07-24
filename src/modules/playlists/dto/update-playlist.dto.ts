import { IsOptional, IsString, MaxLength } from 'class-validator';

// DTO quy định dữ liệu đầu vào khi cập nhật thông tin danh sách phát
export class UpdatePlaylistDto {
  @IsOptional()
  @IsString({ message: 'Tên danh sách phát phải là chuỗi ký tự.' })
  @MaxLength(50, { message: 'Tên danh sách phát tối đa 50 ký tự.' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi ký tự.' })
  @MaxLength(200, { message: 'Mô tả tối đa 200 ký tự.' })
  description?: string;
}
