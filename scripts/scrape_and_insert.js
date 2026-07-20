const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');

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
  spotifyId: { type: String, default: '' },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '' },
});

const SongSchema = new mongoose.Schema({
  title: { type: String, required: true },
  duration: { type: Number, required: true },
  youtubeVideoId: { type: String, default: '' },
  artwork: { type: String, default: '' },
  genre: { type: String, default: 'Pop' },
  artists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Artist' }],
  streamUrl: { type: String, default: '' },
  lyrics: { type: String, default: '' },
  syncedLyrics: { type: String, default: '' },
  spotifyId: { type: String, default: '' },
  playsCount: { type: Number, default: 0 },
});

const Artist = mongoose.models.Artist || mongoose.model('Artist', ArtistSchema);
const Song = mongoose.models.Song || mongoose.model('Song', SongSchema);

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Kết nối database thành công!');

    // Lấy thông tin từ iTunes đã tìm thấy ở trên
    const trackName = 'Mắt Môi Tay Chân';
    const durationSec = 192;
    const primaryGenreName = 'Hip-Hop/Rap';
    const artworkUrl = 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3b/9b/53/3b9b5306-a684-18fe-c422-447879d096c7/1200214343408.jpg/480x480bb.jpg';
    
    // Tìm lyrics trên LRCLIB
    let lyricsData = { lyrics: '', syncedLyrics: '' };
    try {
      console.log('Đang tìm lời bài hát trên LRCLIB...');
      const lrcRes = await axios.get('https://lrclib.net/api/get', {
        params: {
          artist_name: 'MCK',
          track_name: trackName,
          duration: durationSec,
        },
        headers: {
          'User-Agent': 'MusicHubCrawler/1.0.0 (https://github.com/admin/music-app)',
        },
        timeout: 8000,
      });
      if (lrcRes.data && (lrcRes.data.plainLyrics || lrcRes.data.syncedLyrics)) {
        lyricsData = {
          lyrics: lrcRes.data.plainLyrics || '',
          syncedLyrics: lrcRes.data.syncedLyrics || '',
        };
        console.log('Đã lấy lời bài hát bằng API get!');
      }
    } catch (err) {
      console.log('API get thất bại, thử API search...');
      try {
        const searchResponse = await axios.get('https://lrclib.net/api/search', {
          params: { track_name: trackName, artist_name: 'MCK' },
          headers: {
            'User-Agent': 'MusicHubCrawler/1.0.0 (https://github.com/admin/music-app)',
          },
          timeout: 8000,
        });
        const results = searchResponse.data || [];
        const bestMatch = results.find((r) => r.plainLyrics || r.syncedLyrics);
        if (bestMatch) {
          lyricsData = {
            lyrics: bestMatch.plainLyrics || '',
            syncedLyrics: bestMatch.syncedLyrics || '',
          };
          console.log('Đã lấy lời bài hát bằng API search!');
        }
      } catch (searchErr) {
        console.log('Không lấy được lời bài hát:', searchErr.message);
      }
    }

    // Các nghệ sĩ của bài hát: RPT MCK, Tage
    const artistNames = ['RPT MCK', 'Tage'];
    const artistIds = [];

    for (const name of artistNames) {
      const pseudoSpotifyArtistId = `artist_${String(name).replace(/[^a-zA-Z0-9]/g, '')}`;
      let artistDoc = await Artist.findOne({ spotifyId: pseudoSpotifyArtistId });
      if (!artistDoc) {
        artistDoc = await Artist.create({
          name: name,
          spotifyId: pseudoSpotifyArtistId,
          avatar: artworkUrl.replace('480x480bb.jpg', '240x240bb.jpg'),
          bio: 'Nghệ sĩ hiện đại được đồng bộ từ kho nhạc.',
        });
        console.log(`Đã tạo mới nghệ sĩ: ${name}`);
      } else {
        console.log(`Nghệ sĩ đã tồn tại: ${name}`);
      }
      artistIds.push(artistDoc._id);
    }

    const pseudoSpotifyTrackId = 'track_6779205353'; // từ iTunes trackId
    const youtubeVideoId = 'L4dSipbZj8A';

    const song = await Song.findOneAndUpdate(
      { spotifyId: pseudoSpotifyTrackId },
      {
        youtubeVideoId: youtubeVideoId,
        title: trackName,
        duration: durationSec,
        artwork: artworkUrl,
        genre: primaryGenreName,
        artists: artistIds,
        streamUrl: `/songs/stream/${youtubeVideoId}`,
        lyrics: lyricsData.lyrics,
        syncedLyrics: lyricsData.syncedLyrics,
        playsCount: 0,
      },
      { upsert: true, new: true }
    );

    console.log('\n--- KẾT QUẢ CÀO VÀ LƯU ---');
    console.log('Bài hát đã được đưa vào DB thành công!');
    console.log(JSON.stringify(song, null, 2));

  } catch (error) {
    console.error('Lỗi:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
