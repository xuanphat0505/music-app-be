const { MongoClient } = require('mongodb');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 1. Đọc và phân tích MONGO_URI từ file .env để kết nối trực tiếp
let mongoUri = '';
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/MONGO_URI\s*=\s*(.+)/);
    if (match) {
      mongoUri = match[1].trim();
    }
  }
} catch (error) {
  console.error('Không thể đọc file .env:', error.message);
}

if (!mongoUri) {
  console.error('Lỗi: Không tìm thấy biến MONGO_URI trong file .env!');
  process.exit(1);
}

// 2. Định nghĩa hàm tìm máy chủ Audius hoạt động ổn định
async function getHealthyNode() {
  try {
    const response = await axios.get('https://api.audius.co', { timeout: 5000 });
    const nodes = response.data?.data;
    if (nodes && nodes.length > 0) {
      return nodes[Math.floor(Math.random() * nodes.length)];
    }
  } catch (error) {
    // Dự phòng khi gặp lỗi mạng
  }
  const fallbackNodes = [
    'https://discoveryprovider.audius.co',
    'https://audius-discovery-1.c-alpha.link',
    'https://audius-metadata-5.figment.io',
  ];
  return fallbackNodes[Math.floor(Math.random() * fallbackNodes.length)];
}

// 3. Hàm chính chạy tiến trình đồng bộ khoảng 7000 bài hát thông qua Album
async function startSync() {
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    console.log('\n=============================================');
    console.log('--- KẾT NỐI MONGODB ATLAS THÀNH CÔNG ---');
    console.log('=============================================\n');

    const db = client.db();
    const artistsCollection = db.collection('artists');
    const albumsCollection = db.collection('albums');
    const songsCollection = db.collection('songs');

    // Xóa sạch toàn bộ dữ liệu trong 3 bảng theo yêu cầu người dùng
    console.log('Đang xóa sạch dữ liệu cũ trong 3 bảng: artists, albums, songs...');
    await artistsCollection.deleteMany({});
    await albumsCollection.deleteMany({});
    await songsCollection.deleteMany({});
    console.log('Đã xóa sạch dữ liệu cũ thành công.\n');

    // Lấy số lượng bài hát hiện tại trong database
    let totalSongs = await songsCollection.countDocuments();
    console.log(`Số lượng bài hát hiện tại trong database: ${totalSongs}`);

    const targetCount = 15000;
    if (totalSongs >= targetCount) {
      console.log(`Database đã đạt hoặc vượt mục tiêu ${targetCount} bài hát. Không cần đồng bộ thêm.`);
      return;
    }

    const nodeUrl = await getHealthyNode();
    console.log(`Sử dụng máy chủ Audius: ${nodeUrl}`);

    let offset = 0;
    const batchLimit = 50;
    let keepGoing = true;

    while (keepGoing && totalSongs < targetCount) {
      console.log(`\n[TIẾN TRÌNH] Tải danh sách Album với offset: ${offset}, limit: ${batchLimit}...`);
      
      let albumsResponse;
      try {
        albumsResponse = await axios.get(`${nodeUrl}/v1/playlists/trending`, {
          params: {
            limit: batchLimit,
            offset: offset,
            type: 'album',
            app_name: 'musichub',
          },
          timeout: 20000,
        });
      } catch (err) {
        console.error(`[LỖI MẠNG] Không thể kết nối tới Audius ở offset ${offset}: ${err.message}. Đang thử lại với node khác...`);
        const newNode = await getHealthyNode();
        console.log(`Đổi sang máy chủ mới: ${newNode}`);
        continue;
      }

      const albums = albumsResponse.data?.data;
      if (!albums || albums.length === 0) {
        console.log('Không còn Album nào khả dụng trên Audius.');
        break;
      }

      console.log(`Tải thành công ${albums.length} Album. Bắt đầu lưu trữ và liên kết dữ liệu...`);

      for (const albumData of albums) {
        if (totalSongs >= targetCount) {
          console.log(`\n[THÀNH CÔNG] Đã đạt mục tiêu ${targetCount} bài hát. Dừng tiến trình.`);
          keepGoing = false;
          break;
        }

        // 1. Đồng bộ thông tin Nghệ sĩ (Artist) sở hữu Album
        const artistUser = albumData.user;
        if (!artistUser) continue;

        let dbArtist = await artistsCollection.findOne({ audiusId: artistUser.id });
        let artistId;

        const artistFields = {
          username: artistUser.handle,
          name: artistUser.name || artistUser.handle,
          avatar: artistUser.profile_picture ? artistUser.profile_picture['150x150'] : '',
          bio: artistUser.bio || '',
          followerCount: artistUser.follower_count || 0,
          updatedAt: new Date()
        };

        if (!dbArtist) {
          const insertResult = await artistsCollection.insertOne({
            audiusId: artistUser.id,
            ...artistFields,
            createdAt: new Date()
          });
          artistId = insertResult.insertedId;
        } else {
          await artistsCollection.updateOne({ _id: dbArtist._id }, { $set: artistFields });
          artistId = dbArtist._id;
        }

        // 2. Đồng bộ thông tin Album
        const artworkUrl = albumData.artwork
          ? albumData.artwork['480x480'] || albumData.artwork['150x150'] || ''
          : '';

        let dbAlbum = await albumsCollection.findOne({ audiusId: albumData.id });
        let albumId;

        const albumFields = {
          title: albumData.playlist_name,
          artwork: artworkUrl,
          artist: artistId,
          updatedAt: new Date()
        };

        if (!dbAlbum) {
          const insertResult = await albumsCollection.insertOne({
            audiusId: albumData.id,
            ...albumFields,
            songs: [],
            createdAt: new Date()
          });
          albumId = insertResult.insertedId;
        } else {
          await albumsCollection.updateOne({ _id: dbAlbum._id }, { $set: albumFields });
          albumId = dbAlbum._id;
        }

        const songIds = [];

        // 3. Đồng bộ danh sách bài hát và tạo liên kết khoá ngoại (Song.album -> Album._id)
        const tracks = albumData.tracks || [];
        for (const track of tracks) {
          const songArtworkUrl = track.artwork
            ? track.artwork['480x480'] || track.artwork['150x150'] || ''
            : artworkUrl;

          let dbSong = await songsCollection.findOne({ audiusId: track.id });
          let songId;

          const songFields = {
            title: track.title,
            duration: Math.round(track.duration || 0),
            artwork: songArtworkUrl,
            genre: track.genre || 'Other',
            audiusPlaysCount: track.play_count || 0,
            artist: artistId,
            album: albumId, // Gắn ID Album trực tiếp vào bài hát
            streamUrl: `/songs/stream/${track.id}`,
            updatedAt: new Date()
          };

          if (!dbSong) {
            const insertResult = await songsCollection.insertOne({
              audiusId: track.id,
              ...songFields,
              playsCount: 0,
              createdAt: new Date()
            });
            songId = insertResult.insertedId;
          } else {
            await songsCollection.updateOne({ _id: dbSong._id }, { $set: songFields });
            songId = dbSong._id;
          }

          if (songId) {
            songIds.push(songId);
          }
        }

        // 4. Lưu liên kết các bài hát ngược lại vào Album (Album.songs -> [Song._id])
        await albumsCollection.updateOne(
          { _id: albumId },
          { $set: { songs: songIds } }
        );

        // Cập nhật số lượng bài hát hiện có
        totalSongs = await songsCollection.countDocuments();
        console.log(`   -> Đã đồng bộ Album: "${albumData.playlist_name}" (${tracks.length} bài). Tiến trình: ${totalSongs}/${targetCount}`);
      }

      offset += batchLimit;
      // Nghỉ ngắn để hạn chế quá tải request lên node
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    console.log(`\n=============================================`);
    console.log(`--- ĐỒNG BỘ HOÀN TẤT THÀNH CÔNG ---`);
    console.log(`Tổng số lượng bài hát hiện có trong MongoDB: ${await songsCollection.countDocuments()}`);
    console.log('=============================================\n');

  } catch (error) {
    console.error('Lỗi xảy ra trong quá trình cào nhạc:', error);
  } finally {
    await client.close();
    console.log('Đã ngắt kết nối database an toàn.');
  }
}

startSync();
