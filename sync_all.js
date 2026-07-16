const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');

// Tự động phân tích file .env để nạp biến môi trường
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
  console.warn('Không thể đọc file .env, sử dụng biến môi trường mặc định.');
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/music-app';
const TARGET_SONGS = 3000; // Đặt mục tiêu 5000 bài hát phổ biến chất lượng cao
const DELAY_MS = 1000; // Trễ nhẹ 1 giây để không bị khóa API

// Danh sách ca sĩ nổi tiếng thế giới và Việt Nam để cào dữ liệu
const POPULAR_ARTISTS = [
  // US-UK Pop / R&B
  'Taylor Swift', 'Ed Sheeran', 'Coldplay', 'The Weeknd', 'Billie Eilish', 
  'Drake', 'Ariana Grande', 'Justin Bieber', 'Eminem', 'Bruno Mars', 
  'Maroon 5', 'Post Malone', 'Rihanna', 'Beyonce', 'Katy Perry', 
  'Dua Lipa', 'Adele', 'Shawn Mendes', 'Camila Cabello', 'Selena Gomez', 
  'One Direction', 'Harry Styles', 'Zayn', 'Lady Gaga', 'Sam Smith', 
  'Charlie Puth', 'Lauv', 'Khalid', 'Sia', 'Halsey', 'Olivia Rodrigo', 
  'Lana Del Rey', 'Troye Sivan', 'John Legend', 'Alicia Keys', 'Usher', 
  'Justin Timberlake', 'Michael Jackson', 'Queen', 'Linkin Park',
  'Ellie Goulding', 'Jessie J', 'Demi Lovato', 'Miley Cyrus',
  
  // EDM / Dance
  'Avicii', 'David Guetta', 'Marshmello', 'Alan Walker', 'Calvin Harris', 
  'The Chainsmokers', 'Kygo', 'Martin Garrix', 'Zedd', 'Alesso', 
  'DJ Snake', 'Clean Bandit', 'Daft Punk',
  
  // Indie / Rock / Alternative
  'Imagine Dragons', 'OneRepublic', 'Twenty One Pilots', 'Bastille', 
  'Kodaline', 'James Arthur', 'Lewis Capaldi', 'Dean Lewis', 'Calum Scott', 
  'Tom Odell', 'John Mayer', 'Jason Mraz', 'Lorde', 'Hozier', 'Passenger',
  
  // V-Pop (Nhạc Việt phổ biến có trên Audius và LRCLIB)
  'Son Tung M-TP', 'Den Vau', 'Hoang Thuy Linh', 'Vu.', 'Da LAB', 
  'Amee', 'Jack - J97', 'Binz', 'Soobin Hoang Son', 'JustaTee', 
  'tlinh', 'MCK', 'Grey D', 'MONO', 'MIN', 'ERIK', 'Duc Phuc', 
  'Phan Manh Quynh', 'My Tam', 'Ha Anh Tuan'
];

// Định nghĩa Mongoose Schemas tương thích với dự án
const ArtistSchema = new mongoose.Schema(
  {
    audiusId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    name: { type: String, required: true, index: true },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '' },
    followerCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const SongSchema = new mongoose.Schema(
  {
    audiusId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, index: true },
    duration: { type: Number, required: true },
    artwork: { type: String, default: '' },
    genre: { type: String, default: '', index: true },
    playsCount: { type: Number, default: 0, index: true },
    audiusPlaysCount: { type: Number, default: 0 },
    artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
    album: { type: mongoose.Schema.Types.ObjectId, ref: 'Album', default: null, index: true },
    streamUrl: { type: String, default: '' },
    lyrics: { type: String, default: '' },
    syncedLyrics: { type: String, default: '' },
  },
  { timestamps: true }
);

const AlbumSchema = new mongoose.Schema(
  {
    audiusId: { type: String, unique: true, sparse: true, index: true },
    title: { type: String, required: true },
    artwork: { type: String, default: '' },
    artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
    songs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }],
  },
  { timestamps: true }
);

const Artist = mongoose.model('Artist', ArtistSchema);
const Song = mongoose.model('Song', SongSchema);
const Album = mongoose.model('Album', AlbumSchema);

// Tiện ích trì hoãn thực thi
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Chuẩn hóa tên để làm sạch các ký tự nhiễu
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\s*[\(\[][fF]eat\..*?[\)\]]/g, '')
    .replace(/\s*[\(\[][fF]eaturings*?.*?[\)\]]/g, '')
    .replace(/\s*[\(\[][oO]fficial.*?[\)\]]/g, '')
    .replace(/\s*[\(\[][lL]yrics*?[\)\]]/g, '')
    .replace(/\s*[\(\[][cC]lean.*?[\)\]]/g, '')
    .replace(/\s*[\(\[][eE]xplicit.*?[\)\]]/g, '')
    .replace(/\s*-\s*Radio\s*Edit/gi, '')
    .replace(/\s*-\s*Original\s*Mix/gi, '')
    .trim();
}

// Lấy danh sách máy chủ API khả dụng từ Audius
async function getHealthyNode() {
  try {
    const response = await axios.get('https://api.audius.co', { timeout: 8000 });
    const hosts = response.data?.data;
    if (hosts && hosts.length > 0) {
      const randomHost = hosts[Math.floor(Math.random() * hosts.length)];
      console.log(`Đã chọn API Node: ${randomHost}`);
      return randomHost;
    }
  } catch (err) {
    console.error('Không thể lấy API Nodes từ Audius, sử dụng node dự phòng:', err.message);
  }
  return 'https://api.audius.co';
}

// Khởi chạy tiến trình đồng bộ dữ liệu theo mô hình Hybrid
async function startSync() {
  try {
    console.log('Đang kết nối tới cơ sở dữ liệu MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Kết nối database thành công!');

    // Lấy số lượng bài hát hiện tại trong database để tiếp tục cào tiếp
    const currentCount = await Song.countDocuments();
    let savedCount = currentCount;
    console.log(`Số lượng bài hát hiện có trong database: ${currentCount} bài.`);

    if (savedCount >= TARGET_SONGS) {
      console.log(`Đã đạt hoặc vượt mục tiêu ${TARGET_SONGS} bài hát. Dừng tiến trình.`);
      process.exit(0);
    }

    const nodeUrl = await getHealthyNode();

    console.log(`\n=================== BẮT ĐẦU PHA ĐỒNG BỘ LAI (Mục tiêu: ${TARGET_SONGS} bài) ===================`);

    for (const artistName of POPULAR_ARTISTS) {
      if (savedCount >= TARGET_SONGS) break;
      console.log(`\n---------------- Ca sĩ: ${artistName.toUpperCase()} ----------------`);

      // 1. Gọi iTunes API để tìm các bài hát nổi tiếng nhất của ca sĩ
      let itunesTracks = [];
      try {
        const itunesRes = await axios.get('https://itunes.apple.com/search', {
          params: {
            term: artistName,
            limit: 40,
            entity: 'song',
          },
          timeout: 10000,
        });
        itunesTracks = itunesRes.data?.results || [];
      } catch (itunesErr) {
        console.error(` -> Lỗi gọi iTunes API cho ca sĩ "${artistName}":`, itunesErr.message);
        await sleep(2000);
        continue;
      }

      console.log(` -> Tìm thấy ${itunesTracks.length} bài hát tiềm năng từ iTunes.`);

      for (const track of itunesTracks) {
        if (savedCount >= TARGET_SONGS) break;

        const itunesTrackName = track.trackName;
        const itunesArtistName = track.artistName;

        // Kiểm tra xem bài hát đã tồn tại trong DB chưa (tránh tải lại)
        const existingSong = await Song.findOne({ title: itunesTrackName }).populate('artist');
        if (existingSong && existingSong.artist && existingSong.artist.name.toLowerCase() === itunesArtistName.toLowerCase()) {
          console.log(`     -> Bài hát "${itunesTrackName}" của "${itunesArtistName}" đã có trong database. Bỏ qua.`);
          continue;
        }

        const duration = Math.round((track.trackTimeMillis || 0) / 1000);
        const releaseYear = track.releaseDate ? new Date(track.releaseDate).getFullYear() : 0;
        const genre = track.primaryGenreName || 'Pop';

        // Lọc nhạc phát hành trước năm 2010 để lấy nhạc hiện đại
        if (releaseYear && releaseYear < 2010) {
          continue;
        }

        // Tối ưu ảnh bìa iTunes lên kích thước 480x480 để giao diện cực nét
        let artworkUrl = track.artworkUrl100 || '';
        if (artworkUrl) {
          artworkUrl = artworkUrl.replace('100x100bb.jpg', '480x480bb.jpg');
        }

        console.log(`\n   [Xử lý] "${itunesTrackName}" - "${itunesArtistName}" (${releaseYear})`);

        // 2. Tìm lời bài hát trên LRCLIB
        let lyricsData = null;
        try {
          const lrcRes = await axios.get('https://lrclib.net/api/get', {
            params: {
              artist_name: itunesArtistName,
              track_name: itunesTrackName,
              duration: duration,
            },
            headers: {
              'User-Agent': 'MusicHubCrawler/1.0.0 (https://github.com/admin/music-app)',
            },
            timeout: 10000,
          });
          if (lrcRes.data && (lrcRes.data.plainLyrics || lrcRes.data.syncedLyrics)) {
            lyricsData = {
              lyrics: lrcRes.data.plainLyrics || '',
              syncedLyrics: lrcRes.data.syncedLyrics || '',
            };
          }
        } catch (lrcErr) {
          // Lỗi 404 hoặc lệch thời lượng -> chuyển sang search gần đúng
          const cleanTitle = cleanText(itunesTrackName);
          const cleanArtist = cleanText(itunesArtistName);
          try {
            const searchResponse = await axios.get('https://lrclib.net/api/search', {
              params: {
                track_name: cleanTitle,
                artist_name: cleanArtist,
              },
              headers: {
                'User-Agent': 'MusicHubCrawler/1.0.0 (https://github.com/admin/music-app)',
              },
              timeout: 10000,
            });
            const results = searchResponse.data || [];
            const bestMatch = results.find((r) => r.plainLyrics || r.syncedLyrics);
            if (bestMatch) {
              lyricsData = {
                lyrics: bestMatch.plainLyrics || '',
                syncedLyrics: bestMatch.syncedLyrics || '',
              };
            }
          } catch (searchErr) {
            // Lỗi kết nối hoặc không tìm thấy lời nhạc
          }
        }

        if (!lyricsData) {
          console.log('     -> Không tìm thấy lời bài hát trên LRCLIB. Bỏ qua.');
          continue;
        }

        // 3. Tìm bài hát tương ứng trên Audius để lấy stream audio
        let streamTrack = null;
        try {
          const audiusSearchRes = await axios.get(`${nodeUrl}/v1/tracks/search`, {
            params: {
              query: `${itunesArtistName} ${itunesTrackName}`,
              app_name: 'musichub_crawler',
            },
            timeout: 10000,
          });
          const searchResults = audiusSearchRes.data?.data || [];
          if (searchResults.length > 0) {
            // Lấy kết quả tốt nhất có liên quan nhất
            streamTrack = searchResults[0];
          }
        } catch (audiusErr) {
          console.error(`     -> Lỗi tìm kiếm audio trên Audius:`, audiusErr.message);
        }

        if (!streamTrack) {
          console.log('     -> Không tìm thấy file audio stream trên Audius. Bỏ qua.');
          continue;
        }

        // 4. Lưu bài hát và nghệ sĩ tương ứng vào DB
        try {
          const audiusArtist = streamTrack.user;
          if (!audiusArtist) continue;

          // Lưu nghệ sĩ liên quan từ Audius
          const artistDoc = await Artist.findOneAndUpdate(
            { audiusId: audiusArtist.id },
            {
              username: audiusArtist.handle,
              name: itunesArtistName, // Giữ tên nghệ sĩ sạch từ iTunes thay vì tên tài khoản Audius
              avatar: audiusArtist.profile_picture ? audiusArtist.profile_picture['150x150'] || '' : '',
              bio: audiusArtist.bio || '',
              followerCount: audiusArtist.follower_count || 0,
            },
            { returnDocument: 'after', upsert: true }
          );

          // Lưu bài hát
          await Song.findOneAndUpdate(
            { audiusId: streamTrack.id },
            {
              title: itunesTrackName, // Dùng tiêu đề chuẩn từ iTunes
              duration: duration,
              artwork: artworkUrl, // Dùng ảnh bìa HD từ iTunes
              genre: genre,
              audiusPlaysCount: streamTrack.play_count || 0,
              artist: artistDoc._id,
              streamUrl: `/songs/stream/${streamTrack.id}`,
              lyrics: lyricsData.lyrics,
              syncedLyrics: lyricsData.syncedLyrics,
            },
            { upsert: true }
          );

          savedCount++;
          console.log(`     -> THÀNH CÔNG [${savedCount}/${TARGET_SONGS}]: Đã lưu vào database.`);
        } catch (saveErr) {
          console.error('     -> Lỗi khi ghi vào Database:', saveErr.message);
        }

        // Delay nhẹ để tránh rate limit các API
        await sleep(DELAY_MS);
      }
    }

    console.log(`\n=================== HOÀN THÀNH ĐỒNG BỘ LAI ===================`);
    console.log(`Tổng số bài hát chất lượng cao có lyrics trong database: ${savedCount}`);
    process.exit(0);
  } catch (err) {
    console.error('Lỗi nghiêm trọng trong quá trình chạy script startSync:', err);
    process.exit(1);
  }
}

startSync();
