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

// M3U - butun dunya radiolari
app.get('/m3u', async (req, res) => {
  try {
    const stations = await getStations();
    const country = req.query.country;
    const genre = req.query.genre;
    const language = req.query.language;
    const codec = req.query.codec;
    const minbitrate = parseInt(req.query.minbitrate) || 0;
    const limit = parseInt(req.query.limit) || stations.length;
    const raw = req.query.raw === '1';

    let filtered = stations;

    // Olke (vergulle ayrilmis, qismen uygunluq)
    if (country) {
      const normalize = (str) => str
        .toLowerCase()
        .replace(/ü/g, 'u')
        .replace(/ö/g, 'o')
        .replace(/ş/g, 's')
        .replace(/ğ/g, 'g')
        .replace(/ı/g, 'i')
        .replace(/ç/g, 'c')
        .replace(/ə/g, 'e');

      const countries = country.split(',').map(c => normalize(c.trim())).filter(Boolean);
      filtered = filtered.filter(s => {
        if (!s.country) return false;
        const nc = normalize(s.country);
        return countries.some(c => nc.includes(c));
      });
    }

    // Janr (vergulle)
    if (genre) {
      const genres = genre.split(',').map(g => g.trim().toLowerCase()).filter(Boolean);
      filtered = filtered.filter(s => s.tags && genres.some(g => s.tags.toLowerCase().includes(g)));
    }

    // Dil
    if (language) {
      const languages = language.split(',').map(l => l.trim().toLowerCase()).filter(Boolean);
      filtered = filtered.filter(s => s.language && languages.some(l => s.language.toLowerCase().includes(l)));
    }

    // Codec
    if (codec) {
      const codecs = codec.split(',').map(c => c.trim().toLowerCase());
      filtered = filtered.filter(s => s.codec && codecs.includes(s.codec.toLowerCase()));
    }

    // Minimum bitrate
    if (minbitrate > 0) {
      filtered = filtered.filter(s => (s.bitrate || 0) >= minbitrate);
    }

    filtered = filtered.slice(0, limit);

    let m3u = '#EXTM3U\n';
    filtered.forEach(st => {
      const url = st.url_resolved || st.url;
      if (!url) return;
      const logo = st.favicon || '';
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

// Axtaris endpointi
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

// Top radiolar (ses sayina gore)
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

// Janr siyahisi
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

// Dil siyahisi
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

// Statistika
app.get('/stats', async (req, res) => {
  try {
    const stations = await getStations();
    const countries = new Set(stations.map(s => s.country).filter(Boolean));
    const languages = new Set(stations.map(s => s.language).filter(Boolean));
    res.json({
      total: stations.length,
      countries: countries.size,
      languages: languages.size
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Cache yenile
app.get('/refresh', async (req, res) => {
  try {
    if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
    const stations = await getStations();
    res.json({ status: 'ok', total: stations.length, time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Radio proxy
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

// Ana sehife
app.get('/', (req, res) => {
  res.send('<h1>Radio API</h1>' +
    '<p>50.000+ dunya radiosu</p>' +
    '<h2>Endpointler</h2>' +
    '<ul>' +
    '<li><a href="/m3u">/m3u</a> - butun radiolar (proxy)</li>' +
    '<li><a href="/m3u?raw=1">/m3u?raw=1</a> - birbasa</li>' +
    '<li><a href="/m3u?limit=5000">/m3u?limit=5000</a> - ilk 5000</li>' +
    '<li><a href="/m3u?country=Azerbaijan">/m3u?country=Azerbaijan</a></li>' +
    '<li><a href="/m3u?country=Turkey,Türkiye">/m3u?country=Turkey,Türkiye</a></li>' +
    '<li><a href="/m3u?genre=pop,rock">/m3u?genre=pop,rock</a></li>' +
    '<li><a href="/m3u?language=english">/m3u?language=english</a></li>' +
    '<li><a href="/m3u?minbitrate=128">/m3u?minbitrate=128</a></li>' +
    '<li><a href="/search?q=bbc">/search?q=bbc</a> - axtaris</li>' +
    '<li><a href="/top?n=100">/top?n=100</a> - top radiolar</li>' +
    '<li><a href="/countries">/countries</a> - olke siyahisi</li>' +
    '<li><a href="/genres">/genres</a> - janr siyahisi</li>' +
    '<li><a href="/languages">/languages</a> - dil siyahisi</li>' +
    '<li><a href="/stats">/stats</a> - statistika</li>' +
    '<li><a href="/refresh">/refresh</a> - cache yenile</li>' +
    '</ul>');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Radio API: http://0.0.0.0:' + PORT);
});
