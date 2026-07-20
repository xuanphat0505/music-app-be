const axios = require('axios');

async function search() {
  try {
    const res = await axios.get('https://itunes.apple.com/search', {
      params: {
        term: 'Mắt Môi Tay Chân MCK',
        limit: 5,
        entity: 'song'
      }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err.message);
  }
}

search();
