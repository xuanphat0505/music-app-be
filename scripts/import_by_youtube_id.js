const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');

// Đọc cấu hình môi trường từ tệp .env của dự án
try {
  const envPath = path.resolve(__dirname, '..', '.env');
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

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/music-app';

const ArtistSchema = new mongoose.Schema({}, { strict: false });
const SongSchema = new mongoose.Schema({}, { strict: false });

const Artist = mongoose.model('Artist', ArtistSchema, 'artists');
const Song = mongoose.model('Song', SongSchema, 'songs');

// Phân giải chuỗi thời lượng dạng ISO 8601 từ YouTube sang số giây tương ứng
function parseDuration(durationStr) {
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || 0, 10);
  const minutes = parseInt(match[2] || 0, 10);
  const seconds = parseInt(match[3] || 0, 10);
  return hours * 3600 + minutes * 60 + seconds;
}

// Giải mã các thực thể HTML phổ biến về ký tự nguyên bản để làm sạch dữ liệu tìm kiếm
function decodeHTMLEntities(text) {
  if (!text) return '';
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Làm sạch tiêu đề video YouTube bằng cách loại bỏ các từ khóa nhiễu để phục vụ tìm kiếm siêu dữ liệu chuẩn
function cleanVideoTitle(title) {
  return title
    .replace(/\[Official.*?\]/gi, '')
    .replace(/\[MV.*?\]/gi, '')
    .replace(/\[Audio.*?\]/gi, '')
    .replace(/\[Lyric.*?\]/gi, '')
    .replace(/\(Official.*?\)/gi, '')
    .replace(/\(MV.*?\)/gi, '')
    .replace(/\(Audio.*?\)/gi, '')
    .replace(/\(Lyric.*?\)/gi, '')
    .replace(/official video/gi, '')
    .replace(/music video/gi, '')
    .replace(/lyric video/gi, '')
    .replace(/official audio/gi, '')
    .replace(/lyrics/gi, '')
    .replace(/m\/v/gi, '')
    .replace(/mv/gi, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Hàm chính kết nối cơ sở dữ liệu phân giải thông tin video YouTube đối khớp siêu dữ liệu nhạc chuẩn và chèn bản ghi bài hát hoàn chỉnh
async function run() {
  const videoId = process.argv[2];

  if (!videoId) {
    console.error('Lỗi: Vui lòng cung cấp YouTube Video ID.');
    console.log('Cách dùng: node scripts/import_by_youtube_id.js <youtube_video_id>');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log('Đã kết nối MongoDB thành công');

    console.log(`Đang cào dữ liệu từ YouTube cho Video ID: ${videoId}...`);
    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const ytRes = await axios.get(ytUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 10000,
    });

    const html = ytRes.data;

    // Trích xuất tiêu đề video YouTube
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    if (!titleMatch) {
      throw new Error('Không thể phân giải tiêu đề từ trang YouTube.');
    }
    const rawTitle = decodeHTMLEntities(titleMatch[1].replace(' - YouTube', '').trim());
    console.log(`Tiêu đề thô từ YouTube: "${rawTitle}"`);

    // Trích xuất thời lượng video từ thẻ meta
    const durationMatch = html.match(/itemprop="duration" content="(PT.*?)"/);
    let videoDuration = 0;
    if (durationMatch) {
      videoDuration = parseDuration(durationMatch[1]);
      console.log(`Thời lượng video: ${videoDuration} giây`);
    } else {
      console.log('Cảnh báo: Không tìm thấy thời lượng video, mặc định là 0 giây.');
    }

    const cleanQuery = cleanVideoTitle(rawTitle);
    console.log(`Tiêu đề đã làm sạch để tìm kiếm: "${cleanQuery}"`);

    console.log('Đang tìm kiếm siêu dữ liệu nhạc chuẩn trên iTunes Search API...');
    const iTunesUrl = `https://itunes.apple.com/search`;
    const iTunesRes = await axios.get(iTunesUrl, {
      params: {
        term: cleanQuery,
        limit: 5,
        entity: 'song',
      },
      timeout: 10000,
    });

    let bestMatch = null;
    if (iTunesRes.data && iTunesRes.data.results && iTunesRes.data.results.length > 0) {
      let minDiff = Infinity;
      for (const item of iTunesRes.data.results) {
        const itemDuration = Math.round(item.trackTimeMillis / 1000);
        const diff = Math.abs(itemDuration - videoDuration);
        if (diff < minDiff) {
          minDiff = diff;
          bestMatch = item;
        }
      }
    }

    let title = '';
    let artistName = '';
    let artwork = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300';
    let duration = videoDuration;
    let spotifyId = `youtube_${videoId}`;
    let artistNamesList = [];

    if (bestMatch) {
      console.log('Đã tìm thấy bản nhạc trùng khớp trên iTunes:');
      console.log(`   - Tên bài hát: ${bestMatch.trackName}`);
      console.log(`   - Nghệ sĩ: ${bestMatch.artistName}`);
      console.log(`   - Độ lệch thời lượng: ${Math.abs(Math.round(bestMatch.trackTimeMillis / 1000) - videoDuration)}s`);

      title = bestMatch.trackName;
      artistName = bestMatch.artistName;
      artwork = bestMatch.artworkUrl100.replace('100x100bb.jpg', '480x480bb.jpg');
      duration = Math.round(bestMatch.trackTimeMillis / 1000);
      spotifyId = bestMatch.trackId.toString();

    } else {
      console.log('Không tìm thấy kết quả khớp trên iTunes, sử dụng dữ liệu thô từ YouTube làm fallback.');
      const parts = rawTitle.split('-');
      if (parts.length >= 2) {
        artistName = parts[0].trim();
        title = parts.slice(1).join('-').trim();
      } else {
        artistName = 'Unknown Artist';
        title = rawTitle;
      }
      title = cleanVideoTitle(title);
      artistName = cleanVideoTitle(artistName);
    }

    // Tách danh sách ca sĩ kết hợp (hỗ trợ cả "x", "feat", "ft", "&", "and")
    artistNamesList = artistName
      .split(/,|\bx\b|\bfeat\b|\bfeat\.\b|\bft\b|\bft\.\b|&|\band\b/gi)
      .map(name => name.trim())
      .filter(Boolean);

    // Thực hiện tìm kiếm hoặc tạo nghệ sĩ liên kết trong DB
    const artistIds = [];
    for (const name of artistNamesList) {
      let artistDoc = await Artist.findOne({ name: new RegExp('^' + name + '$', 'i') });
      if (!artistDoc) {
        const cleanSpotifyId = `custom_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const cleanUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        artistDoc = await Artist.create({
          spotifyId: cleanSpotifyId,
          username: cleanUsername,
          name: name,
          avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=150',
          bio: 'Tự động tạo từ YouTube import',
          followerCount: 0,
        }).catch(async () => {
          return await Artist.findOne({ spotifyId: cleanSpotifyId });
        });
        console.log(`Đã tạo nghệ sĩ mới: "${name}"`);
      } else {
        console.log(`Đã tìm thấy nghệ sĩ sẵn có: "${name}"`);
      }
      artistIds.push(artistDoc._id);
    }

    let plainLyrics = '';
    let syncedLyrics = '';

    console.log('Đang tìm lời bài hát (Lyrics & Synced) từ LRCLIB...');
    try {
      const lrcRes = await axios.get('https://lrclib.net/api/get', {
        params: {
          artist_name: artistNamesList[0],
          track_name: title,
          duration: duration,
        },
        timeout: 8000,
      });

      if (lrcRes.data) {
        plainLyrics = lrcRes.data.plainLyrics || '';
        syncedLyrics = lrcRes.data.syncedLyrics || '';
        console.log('Đã tìm thấy lời bài hát đồng bộ thời gian từ LRCLIB!');
      }
    } catch {
      console.log('Không tìm thấy lời bài hát khớp trên LRCLIB theo thông tin chuẩn, đang thử tìm kiếm tự do...');
      try {
        // Lần thử 1: Tìm kiếm theo [Tên bài hát] + [Tên ca sĩ đầu tiên]
        const query1 = `${title} ${artistNamesList[0]}`;
        console.log(`Đang thử tìm kiếm với từ khóa: "${query1}"...`);
        let searchRes = await axios.get('https://lrclib.net/api/search', {
          params: { q: query1 },
          timeout: 8000,
        });
        
        // Lần thử 2: Nếu không thấy, tìm kiếm chỉ theo [Tên bài hát]
        if (!searchRes.data || searchRes.data.length === 0) {
          const query2 = title;
          console.log(`Không tìm thấy kết quả. Đang thử tìm kiếm chỉ với tiêu đề bài hát: "${query2}"...`);
          searchRes = await axios.get('https://lrclib.net/api/search', {
            params: { q: query2 },
            timeout: 8000,
          });
        }

        if (searchRes.data && searchRes.data.length > 0) {
          // Lọc kết quả tốt nhất dựa trên ca sĩ hoặc thời lượng
          let bestLrc = searchRes.data[0];
          let bestScore = 0;

          for (const item of searchRes.data) {
            let score = 0;
            if (item.artistName && artistNamesList[0]) {
              const itemArtistLower = item.artistName.toLowerCase();
              const searchArtistLower = artistNamesList[0].toLowerCase();
              if (itemArtistLower.includes(searchArtistLower) || searchArtistLower.includes(itemArtistLower)) {
                score += 10;
              }
            }
            const itemDuration = item.duration || 0;
            const diff = Math.abs(itemDuration - duration);
            if (diff < 5) {
              score += 5;
            } else if (diff < 15) {
              score += 2;
            }
            
            if (score > bestScore) {
              bestScore = score;
              bestLrc = item;
            }
          }

          plainLyrics = bestLrc.plainLyrics || '';
          syncedLyrics = bestLrc.syncedLyrics || '';
          console.log(`Đã lấy lời bài hát thành công: "${bestLrc.trackName}" - ${bestLrc.artistName}`);
        } else {
          console.log('Không tìm thấy bất kỳ kết quả lời bài hát nào.');
        }
      } catch (err) {
        console.log(`Lỗi khi tìm kiếm lời bài hát tự do: ${err.message}`);
      }
    }

    // Nếu không tìm thấy lời bài hát thì không tiến hành tạo hoặc cập nhật bài hát
    if (!plainLyrics) {
      console.log('Hủy bỏ: Không tìm thấy lời bài hát từ LRCLIB. Bài hát sẽ không được tạo hoặc cập nhật.');
      return;
    }

    // Tìm kiếm bài hát cũ để cập nhật đè hoặc tạo mới bài hát hoàn chỉnh
    let songDoc = await Song.findOne({
      $or: [
        { youtubeVideoId: videoId },
        { spotifyId: spotifyId }
      ]
    });

    if (songDoc) {
      console.log(`Bài hát đã tồn tại trong DB, đang cập nhật thông tin mới...`);
      songDoc.youtubeVideoId = videoId;
      songDoc.spotifyId = spotifyId;
      songDoc.title = title;
      songDoc.duration = duration;
      songDoc.artwork = artwork;
      songDoc.artists = artistIds;
      if (plainLyrics) songDoc.lyrics = plainLyrics;
      if (syncedLyrics) songDoc.syncedLyrics = syncedLyrics;
      await songDoc.save();
      console.log(`Đã cập nhật thành công bài hát ID: ${songDoc._id}`);
    } else {
      console.log(`Tạo mới bài hát trong cơ sở dữ liệu...`);
      songDoc = await Song.create({
        spotifyId,
        youtubeVideoId: videoId,
        title,
        duration,
        artwork,
        artists: artistIds,
        lyrics: plainLyrics,
        syncedLyrics: syncedLyrics,
        playsCount: 0,
        spotifyPlaysCount: 0,
      });
      console.log(`Đã chèn thành công bài hát mới với ID: ${songDoc._id}`);
    }

    console.log('\n--- THÔNG TIN CHI TIẾT BÀI HÁT ---');
    console.log(`ID bài hát: ${songDoc._id}`);
    console.log(`Tiêu đề: ${songDoc.title}`);
    console.log(`YouTube Video ID: ${songDoc.youtubeVideoId}`);
    console.log(`Spotify ID: ${songDoc.spotifyId}`);
    console.log(`Ảnh bìa: ${songDoc.artwork}`);
    console.log(`Thời lượng: ${songDoc.duration}s`);
    console.log(`Lời bài hát có sẵn: ${songDoc.lyrics ? 'Có' : 'Không'}`);
    console.log(`Lời bài hát chạy chữ: ${songDoc.syncedLyrics ? 'Có' : 'Không'}`);

  } catch (error) {
    console.error(`Lỗi thực thi tập lệnh: ${error.message}`);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
