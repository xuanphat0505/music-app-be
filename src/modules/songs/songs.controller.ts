import { Controller, Get, Param, Res } from '@nestjs/common';
import { getHealthyNode } from '../../common/utils/audius';

@Controller('songs')
export class SongsController {
  // Tuyến đường redirect trung gian (stream proxy) tự động định tuyến điện thoại tới máy chủ nhạc Audius tối ưu nhất
  @Get('stream/:id')
  async streamSong(@Param('id') audiusId: string, @Res() res: any) {
    const node = await getHealthyNode();
    // Redirect 302 tạm thời sang đường dẫn stream nhạc trực tiếp từ Audius
    return res.redirect(`${node}/v1/tracks/${audiusId}/stream?app_name=musichub`);
  }
}
