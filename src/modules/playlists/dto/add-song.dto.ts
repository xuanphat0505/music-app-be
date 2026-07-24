import { IsNotEmpty, IsString } from 'class-validator';

// DTO quy định dữ liệu đầu vào khi thêm bài hát vào danh sách phát
export class AddSongDto {
  @IsNotEmpty({ message: 'ID bài hát không được để trống.' })
  @IsString({ message: 'ID bài hát phải là chuỗi ký tự.' })
  songId: string;
}
