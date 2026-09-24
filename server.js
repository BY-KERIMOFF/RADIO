const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const CACHE_FILE = path.join(__dirname, 'stations.json');
const CACHE_TIME = 6 * 60 * 60 * 1000;

const MIRRORS = [
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
  'https://fi1.api.radio-browser.info'
];

async function fetchPage(mirror, offset, pageSize) {
  const { data } = await axios.get(mirror + '/json/stations/search', {
    params: {
      limit: pageSize,
      offset: offset,
      hidebroken: true,
      order: 'votes',
      reverse: true
    },
    headers: { 'User-Agent': 'RadioAPI/1.0' },
    timeout: 30000
  });
  return data;
}

async function getStations() {
  if (fs.existsSync(CACHE_FILE)) {
    const stat = fs.statSync(CACHE_FILE);
    if (Date.now() - stat.mtimeMs < CACHE_TIME) {
      console.log('Cache-den oxunur');
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
  }

  const PAGE_SIZE = 500;
  const MAX_PAGES = 100;

  for (const mirror of MIRRORS) {
    try {
      console.log('Mirror yoxlanilir: ' + mirror);
      const test = await fetchPage(mirror, 0, 1);
      if (!Array.isArray(test) || test.length === 0) {
        console.log('  -> bos cavab');
        continue;
      }
      console.log('  -> isleyir, cekilir...');

      let all = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const data = await fetchPage(mirror, page * PAGE_SIZE, PAGE_SIZE);
        if (!Array.isArray(data) || data.length === 0) break;
        all = all.concat(data);
        console.log('  Sehife ' + (page + 1) + ': ' + all.length + ' radio');
        if (data.length < PAGE_SIZE) break;
      }

      if (all.length > 0) {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(all));
        console.log('Cemi ' + all.length + ' radio yuklendi');
        return all;
      }
    } catch (e) {
      console.log('Mirror xeta: ' + mirror + ' - ' + e.message);
    }
  }
  throw new Error('Hec bir mirror islemedi');
}

// M3U - butun radiolar (proxied)
app.get('/m3u', async (req, res) => {
  try {
    const stations = await getStations();
    const country = req.query.country;
    const genre = req.query.genre;
    const limit = parseInt(req.query.limit) || stations.length;
    const raw = req.query.raw === '1';

    let filtered = stations;
    if (country) filtered = filtered.filter(s => s.country && s.country.toLowerCase() === country.toLowerCase());
    if (genre) filtered = filtered.filter(s => s.tags && s.tags.toLowerCase().includes(genre.toLowerCase()));
    filtered = filtered.slice(0, limit);

    let m3u = '#EXTM3U\n';
    filtered.forEach(st => {
      const url = st.url_resolved || st.url;
      if (!url) return;
      const logo = st.favicon || '';
      const group = st.country || 'Other';
      const name = (st.name || 'Unknown').replace(/,/g, '');
      let finalUrl;
      if (raw) {
        finalUrl = url;
      } else {
        finalUrl = 'https://3bneoplay65.xyz/radio/stream?url=' + encodeURIComponent(url);
      }
      m3u += '#EXTINF:-1 tvg-logo="' + logo + '" group-title="' + group + '",' + name + '\n' + finalUrl + '\n';
    });

    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.send(m3u);
  } catch (e) {
    res.status(500).send('Xeta: ' + e.message);
  }
});

// Radio proxy - VPS radionu ozu cekir
app.get('/stream', async (req, res) => {
  const streamUrl = req.query.url;
  if (!streamUrl) return res.status(400).send('url parametri lazimdir');

  try {
    const response = await axios({
      method: 'get',
      url: streamUrl,
      responseType: 'stream',
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (RadioProxy/1.0)',
        'Icy-MetaData': '1'
      },
      maxRedirects: 5,
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
    });

    res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (response.headers['icy-name']) res.setHeader('icy-name', response.headers['icy-name']);
    if (response.headers['icy-genre']) res.setHeader('icy-genre', response.headers['icy-genre']);
    if (response.headers['icy-br']) res.setHeader('icy-br', response.headers['icy-br']);

    response.data.pipe(res);

    req.on('close', () => {
      try { response.data.destroy(); } catch (e) {}
    });
  } catch (e) {
    console.log('Stream xeta: ' + streamUrl + ' - ' + e.message);
    if (!res.headersSent) res.status(502).send('Yayim alinmadi');
  }
});

// Olke siyahisi
app.get('/countries', async (req, res) => {
  try {
    const stations = await getStations();
    const countries = [...new Set(stations.map(s => s.country).filter(Boolean))].sort();
    res.json(countries);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Statistika
app.get('/stats', async (req, res) => {
  try {
    const stations = await getStations();
    res.json({ total: stations.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Cache-i mecburi yenile (cron ucun)
app.get('/refresh', async (req, res) => {
  try {
    if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
    const stations = await getStations();
    res.json({ status: 'ok', total: stations.length, time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ana sehife
app.get('/', (req, res) => {
  res.send('<h1>Radio API isleyir</h1><ul>' +
    '<li><a href="/m3u">/m3u</a> - butun radiolar (proxy)</li>' +
    '<li><a href="/m3u?raw=1">/m3u?raw=1</a> - birbasa radiolar</li>' +
    '<li><a href="/m3u?country=Azerbaijan">/m3u?country=Azerbaijan</a></li>' +
    '<li><a href="/m3u?genre=pop&limit=100">/m3u?genre=pop&limit=100</a></li>' +
    '<li><a href="/countries">/countries</a></li>' +
    '<li><a href="/stats">/stats</a></li>' +
    '<li><a href="/refresh">/refresh</a> - cache yenile</li>' +
    '</ul>');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Radio API: http://0.0.0.0:' + PORT);
});
