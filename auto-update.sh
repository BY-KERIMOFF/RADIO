#!/bin/bash

# Radio API - Avtomatik yenileme ve GitHub push
# Her gunde 2 defe isleyir

cd /var/www/3bneoplay65.xyz/radio/ || exit 1

LOG="/var/log/radio-auto-update.log"
echo "=== $(date '+%Y-%m-%d %H:%M:%S') ===" >> $LOG

# 1. Cache-i yenile
echo "[1/4] Cache yenilenir..." >> $LOG
curl -s "https://3bneoplay65.xyz/radio/refresh" >> $LOG 2>&1
echo "" >> $LOG

# 2. Butun M3U fayllarini yeniden yarat
echo "[2/4] M3U fayllari yaradilir..." >> $LOG

# Olkeler
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Azerbaijan" -o az.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=turkiye" -o tr.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Germany" -o de.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=The+Russian+Federation" -o ru.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=The+United+States+Of+America" -o us.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=France" -o fr.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=The+United+Kingdom+Of+Great+Britain+And+Northern+Ireland" -o uk.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Italy" -o it.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Spain" -o es.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Ukraine" -o ua.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Kazakhstan" -o kz.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Uzbekistan" -o uz.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Iran" -o ir.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Georgia" -o ge.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Netherlands" -o nl.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Poland" -o pl.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Romania" -o ro.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Greece" -o gr.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Bulgaria" -o bg.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=India" -o in.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=China" -o cn.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Japan" -o jp.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Brazil" -o br.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Canada" -o ca.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Australia" -o au.m3u

# Janrlar
curl -s "https://3bneoplay65.xyz/radio/m3u?genre=pop&limit=2000" -o pop.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?genre=rock&limit=2000" -o rock.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?genre=jazz&limit=2000" -o jazz.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?genre=classical&limit=2000" -o classical.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?genre=news&limit=2000" -o news.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?genre=dance&limit=2000" -o dance.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?genre=hiphop&limit=2000" -o hiphop.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?genre=country&limit=2000" -o country.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?genre=oldies&limit=2000" -o oldies.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?genre=electronic&limit=2000" -o electronic.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?genre=folk&limit=2000" -o folk.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?genre=reggae&limit=2000" -o reggae.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?genre=blues&limit=2000" -o blues.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?genre=metal&limit=2000" -o metal.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?genre=rap&limit=2000" -o rap.m3u

# Xususi
curl -s "https://3bneoplay65.xyz/radio/m3u" -o radio.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?limit=5000" -o top5000.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?minbitrate=128" -o highquality.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=turkiye" -o turkish.m3u

# 3. Statistika
echo "[3/4] Fayllar:" >> $LOG
for f in *.m3u; do
  count=$(grep -c "EXTINF" "$f" 2>/dev/null)
  echo "  $f: $count radio" >> $LOG
done

# 4. GitHub-a push
echo "[4/4] GitHub-a push edilir..." >> $LOG

# Fayllari elave et
git add *.m3u 2>> $LOG

# Deyisiklik var?
if git diff --cached --quiet; then
  echo "  Deyisiklik yoxdur, push edilmir" >> $LOG
else
  git commit -m "Auto-update playlists - $(date '+%Y-%m-%d %H:%M')" >> $LOG 2>&1
  git push >> $LOG 2>&1
  echo "  Push uğurlu!" >> $LOG
fi

echo "=== Bitdi: $(date '+%Y-%m-%d %H:%M:%S') ===" >> $LOG
echo "" >> $LOG
