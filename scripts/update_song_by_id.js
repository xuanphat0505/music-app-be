const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');

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

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/music-app';

const ArtistSchema = new mongoose.Schema({
  name: { type: String, required: true },
});

const SongSchema = new mongoose.Schema({
  title: { type: String, required: true },
  duration: { type: Number, required: true },
  youtubeVideoId: { type: String, default: '' },
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
});

const Artist = mongoose.model('Artist', ArtistSchema);
const Song = mongoose.model('Song', SongSchema);

// Đệ quy tìm videoRenderer trong phản hồi JSON từ YouTube
function findVideoRenderers(obj, results = []) {
  if (!obj || typeof obj !== 'object') return results;

  if (obj.videoRenderer) {
    results.push(obj.videoRenderer);
  }

  for (const key of Object.keys(obj)) {
    try {
      findVideoRenderers(obj[key], results);
    } catch {
      // Bỏ qua lỗi
    }
  }

  return results;
}

// Tìm kiếm video ID của bài hát trên YouTube sử dụng thuật toán nâng cấp
async function findYoutubeVideoId(trackName, artistName, durationSec) {
  const query = `${trackName} ${artistName} audio`;
  const url = 'https://www.youtube.com/results';

  try {
    const response = await axios.get(url, {
      params: { search_query: query },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 10000,
    });

    const html = response.data;
    const match = html.match(/var ytInitialData = ({[\s\S]*?});/);
    if (!match) return '';

    const jsonStr = match[1];
    const data = JSON.parse(jsonStr);
    const renderers = findVideoRenderers(data);
    if (renderers.length === 0) return '';

    let bestVideoId = '';
    let lowestPenalty = Infinity;

    for (const video of renderers) {
      if (!video.videoId || !video.title || !video.lengthText) continue;

      const videoTitle = (
        video.title.runs?.[0]?.text ||
        video.title.simpleText ||
        ''
      ).toLowerCase();
      const durationText =
        video.lengthText.runs?.[0]?.text || video.lengthText.simpleText || '';

      let videoDuration = 0;
      const timeParts = durationText.split(':').map(Number);
      if (timeParts.length === 2) {
        videoDuration = timeParts[0] * 60 + timeParts[1];
      } else if (timeParts.length === 3) {
        videoDuration =
          timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
      }

      const durationDiff = Math.abs(videoDuration - durationSec);
      let penalty = durationDiff * 2;

      if (durationDiff > 15) {
        penalty += 100;
      }

      const cleanTitle = videoTitle.toLowerCase();
      if (
        cleanTitle.includes('karaoke') ||
        cleanTitle.includes('instrumental') ||
        cleanTitle.includes('beat')
      ) {
        penalty += 200;
      }

      if (cleanTitle.includes('cover') || cleanTitle.includes('remix')) {
        penalty += 150;
      }

      if (cleanTitle.includes('audio') || cleanTitle.includes('lyric')) {
        penalty -= 30;
      }

      const channelName = (
        video.ownerText?.runs?.[0]?.text ||
        video.shortBylineText?.runs?.[0]?.text ||
        video.longBylineText?.runs?.[0]?.text ||
        ''
      ).toLowerCase();

      // Ưu tiên Topic channel
      if (channelName.includes('topic')) {
        penalty -= 120;
      }

      // Ưu tiên Vevo hoặc Official
      if (
        channelName.includes('vevo') ||
        channelName.includes('official') ||
        cleanTitle.includes('official audio')
      ) {
        penalty -= 50;
      }

      // Ưu tiên thời lượng khớp hoàn hảo
      if (durationDiff <= 3) {
        penalty -= 80;
      }

      if (penalty < lowestPenalty) {
        lowestPenalty = penalty;
        bestVideoId = video.videoId;
      }
    }

    return bestVideoId || renderers[0].videoId;
  } catch (error) {
    console.error(`Lỗi khi tìm kiếm trên YouTube: ${error.message}`);
    return '';
  }
}

// Chạy cập nhật toàn bộ bài hát sử dụng thuật toán nâng cấp mới
async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Đã kết nối MongoDB thành công');

    const excludedIds = [
      '6a5a45fe3cab0bdcbb3b7466',
      '6a5a49be3cab0bdcbb3b7555',
      '6a5a369d3cab0bdcbb3b740f'
    ];

    // Tìm tất cả bài hát ngoại trừ các bài đã được cập nhật trước đó
    const songs = await Song.find({ _id: { $nin: excludedIds } }).populate('artist');
    console.log(`Tìm thấy ${songs.length} bài hát cần kiểm tra và cập nhật.`);

    let updatedCount = 0;
    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      const progressLabel = `[${i + 1}/${songs.length}]`;

      if (!song.artist || !song.artist.name) {
        console.log(`${progressLabel} Bỏ qua bài hát thiếu thông tin nghệ sĩ: "${song.title}"`);
        continue;
      }

      console.log(`${progressLabel} Đang quét bài hát: "${song.title}" - Ca sĩ: "${song.artist.name}"`);
      const newVideoId = await findYoutubeVideoId(song.title, song.artist.name, song.duration);

      if (newVideoId) {
        if (song.youtubeVideoId !== newVideoId) {
          console.log(`   -> Phát hiện Video ID tối ưu hơn: ${song.youtubeVideoId} -> ${newVideoId}`);
          song.youtubeVideoId = newVideoId;
          await song.save();
          updatedCount++;
        } else {
          console.log(`   -> Video ID hiện tại đã tối ưu (${song.youtubeVideoId})`);
        }
      } else {
        console.log(`   -> Không tìm thấy Video ID phù hợp trên YouTube`);
      }

      // Trì hoãn 1.5 giây giữa các bài hát để tránh bị YouTube chặn IP do gửi yêu cầu quá nhanh
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    console.log(`\nHoàn thành quét cơ sở dữ liệu! Đã cập nhật mới ${updatedCount} bài hát.`);
  } catch (err) {
    console.error(`Lỗi hệ thống: ${err.message}`);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
