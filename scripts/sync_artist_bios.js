const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');

// Đọc cấu hình môi trường từ tệp .env nằm ở thư mục cha
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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ Thiếu GEMINI_API_KEY trong file .env!');
  console.error('   Hướng dẫn: Thêm dòng GEMINI_API_KEY=your_key vào server/.env');
  console.error('   Lấy key miễn phí tại: https://aistudio.google.com/app/apikey');
  process.exit(1);
}

const ArtistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '' },
  spotifyId: { type: String },
});

const Artist = mongoose.models.Artist || mongoose.model('Artist', ArtistSchema);

// Tiện ích trì hoãn giữa các lần gọi API để tránh bị rate-limit
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Hàm trích xuất số giây cần retry từ thông báo lỗi quota của Gemini API
function parseRetryDelay(errMsg) {
  const match = errMsg?.match(/retry in ([\d.]+)s/i);
  return match ? Math.ceil(parseFloat(match[1])) * 1000 : 60000;
}

// Hàm gọi Gemini API để sinh tiểu sử nghệ sĩ, tự động retry khi gặp lỗi quota exceeded
async function generateBioWithGemini(artistName, retryCount = 0) {
  const MAX_RETRIES = 2;
  const prompt = `Bạn là một biên tập viên âm nhạc chuyên viết tiểu sử nghệ sĩ Việt Nam.
Hãy viết một đoạn tiểu sử ngắn (2–4 câu, khoảng 80–150 từ) cho nghệ sĩ tên "${artistName}" theo phong cách thân thiện, gần gũi, truyền cảm hứng.
Yêu cầu:
- Đề cập đến phong cách âm nhạc nếu biết (rap, R&B, pop, indie...).
- Viết bằng tiếng Việt, tone ấm áp, không quá hoa mỹ.
- Nếu không biết chắc thông tin, hãy dùng ngôn từ linh hoạt, tránh bịa đặt.
- Không được bắt đầu bằng "Tôi" hoặc "Bạn".
Chỉ trả về đoạn tiểu sử, không cần giải thích thêm.`;

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 300,
        },
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text && text.trim().length > 10) {
      return text.trim();
    }
  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message;
    const isQuotaError = errMsg?.toLowerCase().includes('quota') || err.response?.status === 429;

    if (isQuotaError && retryCount < MAX_RETRIES) {
      const waitMs = parseRetryDelay(errMsg);
      console.log(`   ⏳ Quota exceeded — chờ ${waitMs / 1000}s rồi thử lại (lần ${retryCount + 1}/${MAX_RETRIES})...`);
      await delay(waitMs);
      return generateBioWithGemini(artistName, retryCount + 1);
    }

    console.error(`   ⚠ Lỗi gọi Gemini cho "${artistName}": ${errMsg}`);
  }
  return null;
}

// Tiến trình đồng bộ tiểu sử cho toàn bộ nghệ sĩ có bio cũ hoặc rỗng trong cơ sở dữ liệu
async function runSync() {
  try {
    console.log('🔌 Đang kết nối tới MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Kết nối database thành công!\n');

    // Lọc tất cả nghệ sĩ có tiểu sử rỗng hoặc là chuỗi mặc định cũ
    const artists = await Artist.find({
      $or: [
        { bio: { $exists: false } },
        { bio: '' },
        { bio: null },
        { bio: /Nghệ sĩ hiện đại được đồng bộ từ kho nhạc/i },
        { bio: /Nghệ sĩ được tạo tự động/i },
        { bio: /được yêu mến với những sản phẩm âm nhạc/i },
      ],
    });

    console.log(`🎤 Tìm thấy ${artists.length} nghệ sĩ cần cập nhật tiểu sử.\n`);

    let updatedCount = 0;
    let failedCount = 0;

    for (const artist of artists) {
      process.stdout.write(`⏳ Đang sinh bio cho: "${artist.name}"... `);
      const bio = await generateBioWithGemini(artist.name);

      if (bio) {
        artist.bio = bio;
        await artist.save();
        updatedCount++;
        console.log(`✅ Xong!`);
        console.log(`   → ${bio.substring(0, 80)}...\n`);
      } else {
        // Tiểu sử dự phòng khi Gemini không phản hồi được
        artist.bio = `${artist.name} là một nghệ sĩ âm nhạc tài năng, mang đến những trải nghiệm âm nhạc độc đáo và đầy cảm xúc cho khán giả yêu nhạc Việt Nam.`;
        await artist.save();
        failedCount++;
        console.log(`⚠ Dùng fallback.`);
      }

      // Giãn cách 1 giây giữa các request để tránh vượt rate-limit của Gemini free tier
      await delay(1000);
    }

    console.log(`\n==============================================`);
    console.log(`🏁 HOÀN THÀNH ĐỒNG BỘ TIỂU SỬ NGHỆ SĨ`);
    console.log(`   ✅ Sinh bằng Gemini: ${updatedCount} nghệ sĩ`);
    console.log(`   ⚠  Dùng fallback:   ${failedCount} nghệ sĩ`);
    console.log(`   📊 Tổng xử lý:      ${artists.length} nghệ sĩ`);
    console.log(`==============================================`);
  } catch (err) {
    console.error('❌ Lỗi nghiêm trọng trong tiến trình đồng bộ:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Đã ngắt kết nối database.');
  }
}

runSync();
