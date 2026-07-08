import { Controller, HttpException, HttpStatus, Post, Query } from '@nestjs/common';
import { SyncService } from './sync.service';
import { ResponseMessage } from '@/common/decorators/response-message.decorator';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  // Kích hoạt đồng bộ nhạc và album thủ công từ Audius API về MongoDB với tham số tuỳ chỉnh giới hạn và phân trang qua query
  @Post('trigger')
  @ResponseMessage('Đồng bộ dữ liệu nhạc và album từ Audius thành công.')
  async triggerSync(
    @Query('songsLimit') songsLimit?: string,
    @Query('albumsLimit') albumsLimit?: string,
    @Query('songsOffset') songsOffset?: string,
    @Query('albumsOffset') albumsOffset?: string,
  ) {
    const parsedSongsLimit = songsLimit ? parseInt(songsLimit, 10) : 50;
    const parsedAlbumsLimit = albumsLimit ? parseInt(albumsLimit, 10) : 10;
    const parsedSongsOffset = songsOffset ? parseInt(songsOffset, 10) : 0;
    const parsedAlbumsOffset = albumsOffset ? parseInt(albumsOffset, 10) : 0;

    const songsSuccess = await this.syncService.syncTrendingTracks(parsedSongsLimit, parsedSongsOffset);
    const albumsSuccess = await this.syncService.syncTrendingAlbums(parsedAlbumsLimit, parsedAlbumsOffset);
    
    if (!songsSuccess && !albumsSuccess) {
      throw new HttpException(
        'Đồng bộ dữ liệu nhạc và album thất bại. Vui lòng kiểm tra lại log server.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return { success: true };
  }
}
