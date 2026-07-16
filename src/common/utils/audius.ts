import axios from 'axios';

let cachedNode: string | null = null;
let lastNodeFetch = 0;

// Tìm kiếm và lấy API Node hoạt động ổn định từ hệ thống Audius để phát nhạc
export async function getHealthyNode(): Promise<string> {
  const now = Date.now();
  if (cachedNode && now - lastNodeFetch < 3600000) {
    return cachedNode;
  }

  let nodeToReturn = '';

  try {
    const response = await axios.get('https://api.audius.co', {
      timeout: 5000,
    });
    const nodes = response.data?.data;
    if (nodes && nodes.length > 0) {
      nodeToReturn = nodes[Math.floor(Math.random() * nodes.length)];
      cachedNode = nodeToReturn;
      lastNodeFetch = now;
      return nodeToReturn;
    }
  } catch {
    // Tiếp tục chuyển xuống phương án dự phòng nếu xảy ra lỗi mạng
  }

  const fallbackNodes = [
    'https://discoveryprovider.audius.co',
    'https://audius-discovery-1.c-alpha.link',
    'https://audius-metadata-5.figment.io',
  ];
  nodeToReturn =
    fallbackNodes[Math.floor(Math.random() * fallbackNodes.length)];
  cachedNode = nodeToReturn;
  lastNodeFetch = now;
  return nodeToReturn;
}
