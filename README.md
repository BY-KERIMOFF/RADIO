# RADIO API

Dunya radiolarini (50.000+) cekib M3U formatinda veren API.

## Xususiyyetler

- 50.000+ radio stansiyasi
- M3U formatinda cixis
- Olke, janr uzre filtr
- Proxy rejimi
- Raw rejimi
- 6 saatliq cache
- Gunde 2 defe avtomatik yenileme

## Quraşdirma

npm install
node server.js

## API Endpointler

- /m3u - Butun radiolar (proxy)
- /m3u?raw=1 - Butun radiolar (birbasa)
- /m3u?country=Azerbaijan - Olke uzre
- /m3u?genre=pop - Janr uzre
- /m3u?limit=500 - Limit ile
- /stream?url=... - Tek radio proxy
- /countries - Olke siyahisi
- /stats - Statistika
- /refresh - Cache yenile

## Lisenziya

MIT
