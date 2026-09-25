const axios = require('axios');
const fs = require('fs');
const path = require('path');

const RG_FILE = path.join(__dirname, 'radio-garden.json');
const RG_CACHE_TIME = 24 * 60 * 60 * 1000;

async function getRadioGardenStations() {
  if (fs.existsSync(RG_FILE)) {
    const stat = fs.statSync(RG_FILE);
    if (Date.now() - stat.mtimeMs < RG_CACHE_TIME) {
      console.log('Radio Garden cache-den oxunur');
      return JSON.parse(fs.readFileSync(RG_FILE, 'utf8'));
    }
  }

  try {
    console.log('Radio Garden-den cekilir...');
    const { data } = await axios.get('https://radio.garden/api/ara/content/places', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 30000
    });

    const places = (data && data.data && data.data.list) || [];
    console.log('Yerler: ' + places.length);

    const stations = [];
    const limit = Math.min(places.length, 800);

    for (let i = 0; i < limit; i++) {
      const place = places[i];
      try {
        const { data: page } = await axios.get(
          'https://radio.garden/api/ara/content/page/' + place.id + '/channels',
          { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }
        );
        const items = (page && page.data && page.data.content && page.data.content[0] && page.data.content[0].items) || [];
        for (const ch of items) {
          if (ch.page && ch.page.url && ch.title) {
            stations.push({
              stationuuid: 'rg-' + ch.page.url,
              name: ch.title,
              url: 'https://radio.garden/api/ara/content/listen/' + ch.page.url + '/channel.mp3',
              url_resolved: 'https://radio.garden/api/ara/content/listen/' + ch.page.url + '/channel.mp3',
              favicon: (ch.page && ch.page.logo) || '',
              country: place.country || place.title || '',
              tags: 'radio-garden',
              language: '',
              codec: 'MP3',
              bitrate: 128,
              votes: 0
            });
          }
        }
        if ((i + 1) % 50 === 0) console.log('  ' + (i + 1) + '/' + limit + ' yer, ' + stations.length + ' radio');
      } catch (e) {}
    }

    fs.writeFileSync(RG_FILE, JSON.stringify(stations));
    console.log('Radio Garden: ' + stations.length + ' radio yuklendi');
    return stations;
  } catch (e) {
    console.log('Radio Garden xeta: ' + e.message);
    return [];
  }
}

module.exports = { getRadioGardenStations };
