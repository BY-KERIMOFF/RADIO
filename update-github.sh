#!/bin/bash
cd /var/www/3bneoplay65.xyz/radio/

# Ölkələr
curl -s "https://3bneoplay65.xyz/radio/m3u?country=Azerbaijan" -o az.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?country=turk" -o tr.m3u
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

# Xususi
curl -s "https://3bneoplay65.xyz/radio/m3u?limit=5000" -o top5000.m3u
curl -s "https://3bneoplay65.xyz/radio/m3u?minbitrate=128" -o highquality.m3u

# GitHub-a push
git add *.m3u
git commit -m "Auto-update - $(date '+%Y-%m-%d %H:%M')" 2>/dev/null
git push
