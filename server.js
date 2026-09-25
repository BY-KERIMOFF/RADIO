const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const CACHE_FILE = path.join(__dirname, 'stations.json');
const CACHE_TIME = 6 * 60 * 60 * 1000;

// Radio Garden
// const RG_FILE = path.join(__dirname, 'radio-garden.json');
// const RG_CACHE_TIME = 24 * 60 * 60 * 1000;

const MIRRORS = [
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
  'https://fi1.api.radio-browser.info'
];

// ============ RADIO-BROWSER ============

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

// ============ RADIO GARDEN ============

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

// ============ M3U ============

app.get('/m3u', async (req, res) => {
  try {
    const stations = await getStations();
    let country = req.query.country;
    let genre = req.query.genre;
    let language = req.query.language;
    try { if (country) country = decodeURIComponent(country); } catch (e) {}
    try { if (genre) genre = decodeURIComponent(genre); } catch (e) {}
    try { if (language) language = decodeURIComponent(language); } catch (e) {}

    const codec = req.query.codec;
    const minbitrate = parseInt(req.query.minbitrate) || 0;
    const limit = parseInt(req.query.limit) || stations.length;
    const raw = req.query.raw === '1';

    // Radio Garden radioları
    let rgStations = [];
    if (req.query.rg === '1' || req.query.source === 'all') {
      rgStations = await getRadioGardenStations();
    }

    let filtered = [...stations, ...rgStations];

    if (country) {
      const normalize = (str) => str.toLowerCase()
        .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ş/g, 's')
        .replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ç/g, 'c')
        .replace(/ə/g, 'e');
      const countries = country.split(',').map(c => normalize(c.trim())).filter(Boolean);
      filtered = filtered.filter(s => {
        if (!s.country) return false;
        const nc = normalize(s.country);
        return countries.some(c => nc.includes(c));
      });
    }

    if (genre) {
      const genres = genre.split(',').map(g => g.trim().toLowerCase()).filter(Boolean);
      filtered = filtered.filter(s => s.tags && genres.some(g => s.tags.toLowerCase().includes(g)));
    }

    if (language) {
      const languages = language.split(',').map(l => l.trim().toLowerCase()).filter(Boolean);
      filtered = filtered.filter(s => s.language && languages.some(l => s.language.toLowerCase().includes(l)));
    }

    if (codec) {
      const codecs = codec.split(',').map(c => c.trim().toLowerCase());
      filtered = filtered.filter(s => s.codec && codecs.includes(s.codec.toLowerCase()));
    }

    if (minbitrate > 0) {
      filtered = filtered.filter(s => (s.bitrate || 0) >= minbitrate);
    }

    filtered = filtered.slice(0, limit);

    const DEFAULT_LOGO = 'https://3bneoplay65.xyz/radio/logo.svg';
    let m3u = '#EXTM3U\n';
    filtered.forEach(st => {
      const url = st.url_resolved || st.url;
      if (!url) return;
      const logo = (st.favicon && st.favicon.trim()) ? st.favicon : DEFAULT_LOGO;
      const group = st.country || 'Other';
      const name = (st.name || 'Unknown').replace(/,/g, '');
      const finalUrl = raw ? url : 'https://3bneoplay65.xyz/radio/stream?url=' + encodeURIComponent(url);
      m3u += '#EXTINF:-1 tvg-logo="' + logo + '" group-title="' + group + '",' + name + '\n' + finalUrl + '\n';
    });

    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.send(m3u);
  } catch (e) {
    res.status(500).send('Xeta: ' + e.message);
  }
});

// ============ SEARCH ============

app.get('/search', async (req, res) => {
  try {
    const stations = await getStations();
    const q = (req.query.q || '').toLowerCase();
    const limit = parseInt(req.query.limit) || 100;
    if (!q) return res.json([]);

    const results = stations
      .filter(s => (s.name && s.name.toLowerCase().includes(q)) || (s.tags && s.tags.toLowerCase().includes(q)))
      .slice(0, limit)
      .map(s => ({
        name: s.name,
        country: s.country,
        tags: s.tags,
        url: s.url_resolved || s.url,
        favicon: s.favicon,
        bitrate: s.bitrate,
        codec: s.codec
      }));

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ TOP ============

app.get('/top', async (req, res) => {
  try {
    const stations = await getStations();
    const n = parseInt(req.query.n) || 100;
    const top = stations.slice(0, n).map(s => ({
      name: s.name,
      country: s.country,
      url: s.url_resolved || s.url,
      votes: s.votes
    }));
    res.json(top);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ COUNTRIES ============

app.get('/countries', async (req, res) => {
  try {
    const stations = await getStations();
    const countries = [...new Set(stations.map(s => s.country).filter(Boolean))].sort();
    res.json(countries);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ GENRES ============

app.get('/genres', async (req, res) => {
  try {
    const stations = await getStations();
    const tags = new Set();
    stations.forEach(s => {
      if (s.tags) s.tags.split(',').forEach(t => tags.add(t.trim()));
    });
    res.json([...tags].sort().slice(0, 500));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ LANGUAGES ============

app.get('/languages', async (req, res) => {
  try {
    const stations = await getStations();
    const langs = new Set();
    stations.forEach(s => {
      if (s.language) s.language.split(',').forEach(l => langs.add(l.trim()));
    });
    res.json([...langs].sort());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ STATS ============

app.get('/stats', async (req, res) => {
  try {
    const stations = await getStations();
    const countries = new Set(stations.map(s => s.country).filter(Boolean));
    const languages = new Set(stations.map(s => s.language).filter(Boolean));
    const result = {
      total: stations.length,
      countries: countries.size,
      languages: languages.size
    };
    if (fs.existsSync(RG_FILE)) {
      result.radio_garden = JSON.parse(fs.readFileSync(RG_FILE, 'utf8')).length;
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ REFRESH ============

app.get('/refresh', async (req, res) => {
  try {
    if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
    const stations = await getStations();
    res.json({ status: 'ok', total: stations.length, time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ RADIO GARDEN REFRESH ============

app.get('/refresh-rg', async (req, res) => {
  try {
    if (fs.existsSync(RG_FILE)) fs.unlinkSync(RG_FILE);
    const stations = await getRadioGardenStations();
    res.json({ status: 'ok', total: stations.length, time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ STREAM PROXY ============

app.get('/stream', async (req, res) => {
  const streamUrl = req.query.url;
  if (!streamUrl) return res.status(400).send('url parametri lazimdir');

  try {
    const https = require('https');
    const http = require('http');
    const client = streamUrl.startsWith('https') ? https : http;

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Icy-MetaData': '1',
        'Accept': '*/*'
      }
    };

    const proxyReq = client.get(streamUrl, options, (proxyRes) => {
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        return res.redirect('/stream?url=' + encodeURIComponent(proxyRes.headers.location));
      }

      if (proxyRes.statusCode !== 200) {
        if (!res.headersSent) res.status(502).send('Upstream: ' + proxyRes.statusCode);
        return;
      }

      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'audio/mpeg');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      if (proxyRes.headers['icy-name']) res.setHeader('icy-name', proxyRes.headers['icy-name']);
      if (proxyRes.headers['icy-genre']) res.setHeader('icy-genre', proxyRes.headers['icy-genre']);
      if (proxyRes.headers['icy-br']) res.setHeader('icy-br', proxyRes.headers['icy-br']);

      proxyRes.pipe(res);
      proxyRes.on('error', () => {});
    });

    proxyReq.on('error', (e) => {
      if (!res.headersSent) res.status(502).send('Yayim alinmadi');
    });

    proxyReq.setTimeout(15000, () => {
      proxyReq.destroy();
      if (!res.headersSent) res.status(504).send('Timeout');
    });

    req.on('close', () => {
      proxyReq.destroy();
    });
  } catch (e) {
    if (!res.headersSent) res.status(500).send('Xeta: ' + e.message);
  }
});

// ============ STATIC ============

app.use(express.static(__dirname));

// ============ HOME ============

app.get('/', (req, res) => {
  res.send('<h1>Radio API</h1>' +
    '<p>50.000+ dunya radiosu + Radio Garden</p>' +
    '<h2>Endpointler</h2>' +
    '<ul>' +
    '<li><a href="/m3u">/m3u</a> - butun radiolar (proxy)</li>' +
    '<li><a href="/m3u?raw=1">/m3u?raw=1</a> - birbasa</li>' +
    '<li><a href="/m3u?limit=5000">/m3u?limit=5000</a></li>' +
    '<li><a href="/m3u?rg=1&limit=5000">/m3u?rg=1</a> - Radio Garden ile</li>' +
    '<li><a href="/m3u?country=Azerbaijan">/m3u?country=Azerbaijan</a></li>' +
    '<li><a href="/m3u?country=turk">/m3u?country=turk</a></li>' +
    '<li><a href="/m3u?genre=pop,rock">/m3u?genre=pop,rock</a></li>' +
    '<li><a href="/m3u?minbitrate=128">/m3u?minbitrate=128</a></li>' +
    '<li><a href="/search?q=bbc">/search?q=bbc</a></li>' +
    '<li><a href="/top?n=100">/top?n=100</a></li>' +
    '<li><a href="/countries">/countries</a></li>' +
    '<li><a href="/genres">/genres</a></li>' +
    '<li><a href="/languages">/languages</a></li>' +
    '<li><a href="/stats">/stats</a></li>' +
    '<li><a href="/refresh">/refresh</a> - Radio-Browser yenile</li>' +
    '<li><a href="/refresh-rg">/refresh-rg</a> - Radio Garden yenile</li>' +
    '</ul>');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Radio API: http://0.0.0.0:' + PORT);
});
