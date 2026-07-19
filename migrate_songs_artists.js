const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Đọc cấu hình từ file .env
try {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        if (key && !key.startsWith('#')) {
          process.env[key] = value.replace(/^['"]|['"]$/g, '');
        }
      }
    });
  }
} catch (e) {
  console.warn('Không thể đọc cấu hình file .env');
}

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/music-app';

const ArtistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '' },
  spotifyId: { type: String },
});

const SongSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist' }, // trường cũ
  artists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Artist' }], // trường mới
});

const Artist = mongoose.models.Artist || mongoose.model('Artist', ArtistSchema);
const Song = mongoose.models.Song || mongoose.model('Song', SongSchema);

// Hàm tách chuỗi tên nghệ sĩ thành mảng tên nghệ sĩ độc lập
function splitArtists(artistStr) {
  if (!artistStr) return [];
  const regex = /\s+(?:and|&|x|X|feat\.?|ft\.?|featuring)\s+|\s*,\s*/g;
  return artistStr
    .split(regex)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

// Kiểm tra xem tên nghệ sĩ có chứa ký tự kết hợp không
function isCombinationName(name) {
  const regex = /\s+(?:and|&|x|X|feat\.?|ft\.?|featuring)\s+|\s*,\s*/gi;
  return regex.test(name);
}

async function runMigration() {
  try {
    console.log('Đang kết nối tới cơ sở dữ liệu MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Kết nối database thành công!');

    const songs = await Song.find().populate('artist');
    console.log(`Tìm thấy tổng cộng ${songs.length} bài hát cần kiểm tra.`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const song of songs) {
      // Nếu bài hát chưa có trường artists mới hoặc rỗng, ta thực hiện map
      if (!song.artists || song.artists.length === 0) {
        if (!song.artist) {
          console.warn(
            `Bài hát "${song.title}" không có liên kết artist gốc. Bỏ qua.`,
          );
          skippedCount++;
          continue;
        }

        const rawArtistName = song.artist.name;
        const artistNames = splitArtists(rawArtistName);
        const artistIds = [];

        for (const name of artistNames) {
          // Tìm nghệ sĩ đơn lẻ
          let artistDoc = await Artist.findOne({
            name: new RegExp(`^${name}$`, 'i'),
          });

          if (!artistDoc) {
            const pseudoSpotifyArtistId = `artist_${String(name).replace(/[^a-zA-Z0-9]/g, '')}`;
            artistDoc = await Artist.create({
              name,
              spotifyId: pseudoSpotifyArtistId,
              bio: 'Nghệ sĩ được tạo tự động qua tiến trình chuẩn hóa dữ liệu.',
            });
            console.log(`+ Đã tạo nghệ sĩ mới độc lập: "${name}"`);
          }

          artistIds.push(artistDoc._id);
        }

        song.artists = artistIds;
        await song.save();
        migratedCount++;
        console.log(
          `[${migratedCount}] Đã chuẩn hóa bài hát: "${song.title}" -> [${artistNames.join(', ')}]`,
        );
      } else {
        skippedCount++;
      }
    }

    console.log('\n--- BẮT ĐẦU DỌN DẸP NGHỆ SĨ RÁC ---');
    // Tìm tất cả nghệ sĩ trong DB
    const allArtists = await Artist.find();
    let deletedArtistsCount = 0;

    for (const artist of allArtists) {
      if (isCombinationName(artist.name)) {
        // Kiểm tra xem nghệ sĩ rác này còn bài hát nào liên kết qua trường "artist" hay "artists" mới không
        const usageCount = await Song.countDocuments({
          $or: [{ artist: artist._id }, { artists: artist._id }],
        });

        if (usageCount === 0) {
          // Xóa nghệ sĩ rác
          await Artist.findByIdAndDelete(artist._id);
          deletedArtistsCount++;
          console.log(`- Đã xóa nghệ sĩ rác (kết hợp): "${artist.name}"`);
        } else {
          console.log(
            `! Nghệ sĩ "${artist.name}" vẫn còn liên kết với ${usageCount} bài hát. Không xóa.`,
          );
        }
      }
    }

    console.log('\n===== KẾT QUẢ MIGRATION =====');
    console.log(`- Đã cập nhật thành công: ${migratedCount} bài hát.`);
    console.log(
      `- Đã bỏ qua (hoặc đã cập nhật trước đó): ${skippedCount} bài hát.`,
    );
    console.log(
      `- Đã dọn dẹp (xóa): ${deletedArtistsCount} nghệ sĩ kết hợp dư thừa.`,
    );
    console.log('==============================');
  } catch (error) {
    console.error('Lỗi xảy ra trong quá trình migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Đã ngắt kết nối database.');
  }
}

runMigration();
