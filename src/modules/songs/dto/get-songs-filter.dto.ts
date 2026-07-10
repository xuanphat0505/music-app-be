import { IsOptional, IsString, IsNumberString } from 'class-validator';

// DTO quản lý và lọc các tham số truy vấn tìm kiếm, phân trang danh sách bài hát
export class GetSongsFilterDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  sort?: string;
}
