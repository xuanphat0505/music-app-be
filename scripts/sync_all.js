const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');

// Nạp các biến môi trường từ file .env phục vụ kết nối MongoDB
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
  console.warn('Không thể đọc cấu hình file .env, sử dụng kết nối mặc định.');
}

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/music-app';
const TARGET_SONGS = 1000; // Nâng mục tiêu cào lên 500 bài hát hiện đại
const DELAY_MS = 1500; // Trễ giữa các yêu cầu API để tránh bị chặn truy cập

const POPULAR_ARTISTS = [
  // US-UK Pop / R&B
  'Ed Sheeran',
  'The Weeknd',
  'Justin Bieber',
  'Bruno Mars',
  'Maroon 5',
  'One Direction',
  'Charlie Puth',

  // EDM / Dance
  'Avicii',
  'Alan Walker',
  'The Chainsmokers',

  // V-Pop
  'Son Tung M-TP',
  'Den Vau',
  'Hoang Thuy Linh',
  'Vu.',
  'Da LAB',
  'Amee',
  'Jack - J97',
  'Binz',
  'Soobin Hoang Son',
  'JustaTee',
  'tlinh',
  'MCK',
  'Grey D',
  'MONO',
  'MIN',
  'ERIK',
  'Duc Phuc',
  'Phan Manh Quynh',
  'My Tam',
  'Ha Anh Tuan',
  'MONO',
  'B Ray',
  'Thieu Bao Tram',
  'HIEUTHUHAI',
  'Wren Evans',
  'Amee',
  'Vu.',
  'Da LAB',
  'MCK',
  'Obito',
  'Wxrdie',
];

// Danh sách các máy chủ Piped API dùng để tìm kiếm và lấy luồng âm thanh
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.astrian.xyz',
];

// Định nghĩa Mongoose Schemas mới đồng bộ với thiết kế Spotify/YouTube
const ArtistSchema = new mongoose.Schema(
  {
    spotifyId: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: '' },
    name: { type: String, required: true, index: true },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '' },
    followerCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const SongSchema = new mongoose.Schema(
  {
    spotifyId: { type: String, required: true, unique: true, index: true },
    youtubeVideoId: { type: String, default: '', index: true },
    title: { type: String, required: true, index: true },
    duration: { type: Number, required: true },
    artwork: { type: String, default: '' },
    genre: { type: String, default: '', index: true },
    playsCount: { type: Number, default: 0, index: true },
    spotifyPlaysCount: { type: Number, default: 0 },
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Artist',
      required: true,
      index: true,
    },
    album: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Album',
      default: null,
      index: true,
    },
    streamUrl: { type: String, default: '' },
    lyrics: { type: String, default: '' },
    syncedLyrics: { type: String, default: '' },
  },
  { timestamps: true },
);

const AlbumSchema = new mongoose.Schema(
  {
    spotifyId: { type: String, unique: true, sparse: true, index: true },
    title: { type: String, required: true },
    artwork: { type: String, default: '' },
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Artist',
      required: true,
      index: true,
    },
    songs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }],
  },
  { timestamps: true },
);

const Artist = mongoose.model('Artist', ArtistSchema);
const Song = mongoose.model('Song', SongSchema);
const Album = mongoose.model('Album', AlbumSchema);

// Tiện ích trì hoãn tiến trình
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Tiêu đề User-Agent Chrome giả lập để tránh bị máy chủ API từ chối kết nối
const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
};

// Tìm kiếm đệ quy tất cả các đối tượng videoRenderer trong cấu trúc JSON của YouTube
function findVideoRenderers(obj, results = []) {
  if (!obj || typeof obj !== 'object') return results;

  if (obj.videoRenderer) {
    results.push(obj.videoRenderer);
  }

  for (const key of Object.keys(obj)) {
    try {
      findVideoRenderers(obj[key], results);
    } catch (e) {
      // Bỏ qua lỗi truy cập thuộc tính
    }
  }
  return results;
}

// Đối khớp tìm kiếm video YouTube trực tiếp và lựa chọn Video ID khớp nhất
async function findYoutubeVideoId(trackName, artistName, durationSec) {
  const query = `${trackName} ${artistName} audio`;
  const url = 'https://www.youtube.com/results';

  try {
    const response = await axios.get(url, {
      params: { search_query: query },
      headers: COMMON_HEADERS,
      timeout: 10000,
    });

    const html = response.data;

    // Tìm khối định nghĩa ytInitialData chứa dữ liệu JSON trang tìm kiếm
    const match = html.match(/var ytInitialData = ({[\s\S]*?});/);
    if (!match) {
      return '';
    }

    const jsonStr = match[1];
    const data = JSON.parse(jsonStr);

    // Thu thập tất cả các videoRenderer
    const renderers = findVideoRenderers(data);
    if (renderers.length === 0) return '';

    let bestVideoId = '';
    let minScore = Infinity;

    for (const r of renderers) {
      if (!r.videoId || !r.title?.runs?.[0]?.text) continue;

      const videoId = r.videoId;
      const title = r.title.runs[0].text;
      const durationStr = r.lengthText?.simpleText || '';

      // Đổi định dạng thời lượng thành giây
      let videoDuration = 0;
      if (durationStr) {
        const timeParts = durationStr.split(':').map(Number);
        if (timeParts.length === 2) {
          videoDuration = timeParts[0] * 60 + timeParts[1];
        } else if (timeParts.length === 3) {
          videoDuration =
            timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
        }
      }

      const titleLower = title.toLowerCase();
      const trackNameLower = trackName.toLowerCase();
      const artistLower = artistName.toLowerCase();
      const durationDiff = Math.abs(durationSec - videoDuration);

      let penalty = durationDiff;
      if (durationDiff > 15) penalty += 50;

      if (titleLower.includes('audio') || titleLower.includes('lyric')) {
        penalty -= 15;
      }
      if (!titleLower.includes(trackNameLower)) penalty += 30;
      if (!titleLower.includes(artistLower)) penalty += 20;

      if (penalty < minScore) {
        minScore = penalty;
        bestVideoId = videoId;
      }
    }

    // Nếu không tìm được qua thuật toán đối khớp thì lấy video đầu tiên
    return bestVideoId || renderers[0].videoId;
  } catch (error) {
    console.error(
      `     -> Lỗi khi tìm kiếm trực tiếp trên YouTube cho "${query}":`,
      error.message,
    );
    return '';
  }
}

// Làm sạch các ký tự rác trong tiêu đề bài hát để tăng tỉ lệ tìm thấy lyrics
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\s*[\(\[][fF]eat\..*?[\)\]]/g, '')
    .replace(/\s*[\(\[][fF]eaturings*?.*?[\)\]]/g, '')
    .replace(/\s*[\(\[][oO]fficial.*?[\)\]]/g, '')
    .replace(/\s*[\(\[][lL]yrics*?[\)\]]/g, '')
    .trim();
}

// Tiến trình đồng bộ dữ liệu nhạc hiện đại
async function startSync() {
  try {
    console.log('Đang kết nối tới cơ sở dữ liệu MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Kết nối database thành công!');

    // Lấy số lượng bài hát hiện có trong database để cào tiếp tục
    const currentCount = await Song.countDocuments();
    let savedCount = currentCount;
    console.log(
      `Số lượng bài hát hiện có trong database: ${currentCount} bài.`,
    );

    if (savedCount >= TARGET_SONGS) {
      console.log(
        `Đã đạt hoặc vượt mục tiêu ${TARGET_SONGS} bài hát. Dừng tiến trình.`,
      );
      process.exit(0);
    }

    console.log(
      `\n=================== BẮT ĐẦU CÀO TIẾP NHẠC XU HƯỚNG HIỆN ĐẠI (Mục tiêu: ${TARGET_SONGS} bài) ===================`,
    );

    for (const artistName of POPULAR_ARTISTS) {
      if (savedCount >= TARGET_SONGS) break;
      console.log(
        `\n---------------- Đang cào nghệ sĩ: ${artistName.toUpperCase()} ----------------`,
      );

      // Lấy danh sách bài hát từ iTunes API với dữ liệu đầy đủ và định dạng ảnh rõ nét
      let itunesTracks = [];
      try {
        const itunesRes = await axios.get('https://itunes.apple.com/search', {
          params: {
            term: artistName,
            limit: 15,
            entity: 'song',
          },
          headers: COMMON_HEADERS,
          timeout: 10000,
        });
        itunesTracks = itunesRes.data?.results || [];
      } catch (itunesErr) {
        console.error(
          ` -> Lỗi tìm kiếm nghệ sĩ trên iTunes:`,
          itunesErr.message,
        );
        await sleep(2000);
        continue;
      }

      console.log(` -> Tìm thấy ${itunesTracks.length} bài hát từ iTunes.`);

      for (const track of itunesTracks) {
        if (savedCount >= TARGET_SONGS) break;

        const trackName = track.trackName;
        const artistFullName = track.artistName;
        const durationSec = Math.round((track.trackTimeMillis || 0) / 1000);
        const releaseYear = track.releaseDate
          ? new Date(track.releaseDate).getFullYear()
          : 0;

        // Lọc bỏ bài hát quá cũ trước năm 2018 để chỉ lấy nhạc hiện đại
        if (releaseYear && releaseYear < 2018) {
          continue;
        }

        // Kiểm tra xem bài hát đã tồn tại trong DB chưa bằng spotifyId để tránh cào trùng lặp
        const pseudoSpotifyTrackId = `track_${track.trackId}`;
        const existingSong = await Song.findOne({
          spotifyId: pseudoSpotifyTrackId,
        });
        if (existingSong) {
          console.log(
            `     -> Bài hát "${trackName}" đã tồn tại trong cơ sở dữ liệu. Bỏ qua.`,
          );
          continue;
        }

        console.log(
          `\n   [*] Đang xử lý: "${trackName}" - "${artistFullName}" (${releaseYear})`,
        );

        // Tìm lời bài hát trên LRCLIB
        let lyricsData = null;
        try {
          const lrcRes = await axios.get('https://lrclib.net/api/get', {
            params: {
              artist_name: artistFullName,
              track_name: trackName,
              duration: durationSec,
            },
            headers: {
              'User-Agent':
                'MusicHubCrawler/1.0.0 (https://github.com/admin/music-app)',
            },
            timeout: 8000,
          });
          if (
            lrcRes.data &&
            (lrcRes.data.plainLyrics || lrcRes.data.syncedLyrics)
          ) {
            lyricsData = {
              lyrics: lrcRes.data.plainLyrics || '',
              syncedLyrics: lrcRes.data.syncedLyrics || '',
            };
          }
        } catch (lrcErr) {
          // Thực hiện tìm kiếm gần đúng nếu gọi API trực tiếp thất bại
          const cleanTitle = cleanText(trackName);
          const cleanArtist = cleanText(artistFullName);
          try {
            const searchResponse = await axios.get(
              'https://lrclib.net/api/search',
              {
                params: { track_name: cleanTitle, artist_name: cleanArtist },
                headers: {
                  'User-Agent':
                    'MusicHubCrawler/1.0.0 (https://github.com/admin/music-app)',
                },
                timeout: 8000,
              },
            );
            const results = searchResponse.data || [];
            const bestMatch = results.find(
              (r) => r.plainLyrics || r.syncedLyrics,
            );
            if (bestMatch) {
              lyricsData = {
                lyrics: bestMatch.plainLyrics || '',
                syncedLyrics: bestMatch.syncedLyrics || '',
              };
            }
          } catch (searchErr) {
            // Chấp nhận bỏ qua nếu hoàn toàn không có lyrics
          }
        }

        if (!lyricsData) {
          console.log(
            '     -> Không tìm thấy lời Karaoke trên LRCLIB. Bỏ qua.',
          );
          continue;
        }

        // Tìm mã video YouTube tương ứng qua Piped API làm nguồn phát nhạc trực tiếp
        let youtubeVideoId = '';
        try {
          youtubeVideoId = await findYoutubeVideoId(
            trackName,
            artistFullName,
            durationSec,
          );
        } catch (ytErr) {
          console.error(
            `     -> Lỗi khi truy vấn luồng âm thanh YouTube:`,
            ytErr.message,
          );
        }

        if (!youtubeVideoId) {
          console.log(
            '     -> Không tìm thấy mã video stream trên YouTube. Bỏ qua.',
          );
          continue;
        }

        // Lưu thông tin nghệ sĩ vào cơ sở dữ liệu MongoDB
        const pseudoSpotifyArtistId = `artist_${String(track.artistId || track.artistViewUrl || artistFullName).replace(/[^a-zA-Z0-9]/g, '')}`;
        const artistDoc = await Artist.findOneAndUpdate(
          { spotifyId: pseudoSpotifyArtistId },
          {
            name: artistFullName,
            avatar: track.artworkUrl100
              ? track.artworkUrl100.replace('100x100bb.jpg', '240x240bb.jpg')
              : '',
            bio: `Nghệ sĩ hiện đại được đồng bộ từ kho nhạc.`,
          },
          { returnDocument: 'after', upsert: true },
        );

        // Lưu thông tin chi tiết bài hát vào cơ sở dữ liệu MongoDB
        const artworkUrl = track.artworkUrl100
          ? track.artworkUrl100.replace('100x100bb.jpg', '480x480bb.jpg')
          : '';

        await Song.findOneAndUpdate(
          { spotifyId: pseudoSpotifyTrackId },
          {
            youtubeVideoId: youtubeVideoId,
            title: trackName,
            duration: durationSec,
            artwork: artworkUrl,
            genre: track.primaryGenreName || 'Pop',
            artist: artistDoc._id,
            streamUrl: `/songs/stream/${youtubeVideoId}`, // Route phát nhạc thông qua backend proxy
            lyrics: lyricsData.lyrics,
            syncedLyrics: lyricsData.syncedLyrics,
          },
          { upsert: true },
        );

        savedCount++;
        console.log(
          `     -> THÀNH CÔNG [${savedCount}/${TARGET_SONGS}]: Đã đồng bộ lên MongoDB.`,
        );

        await sleep(DELAY_MS);
      }
    }

    console.log(
      `\n=================== HOÀN THÀNH QUY TRÌNH CÀO NHẠC ===================`,
    );
    console.log(
      `Tổng cộng đã cào được ${savedCount} bài hát xu hướng hiện đại có đầy đủ lyrics.`,
    );
    process.exit(0);
  } catch (err) {
    console.error('Lỗi nghiêm trọng trong quá trình chạy script đồng bộ:', err);
    process.exit(1);
  }
}

startSync();
