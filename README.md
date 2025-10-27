# Meltryllis con Arma!
BotDiscord

---
Configuracion docker-compose:

```yaml
# docker-compose.yml
services:
  Meltry:
    image: nowaru124/meltryllis:lastest
    container_name:    
    restart: "recomendado como: on-failure:2"
    environment:
      - DISCORD_BOT_TOKEN= "Token"
      - OWNER_BOT_ID= "User ID owner"
      - LANGS_SUPPORTED= "Idiomas soportados"
      - LOCALE= "Lenguaje main" 
      - REPLY_OTHER_BOTS= "true/false"
      - DEBUG_MODE= "0 Debug/ >0 produccion"
      - STATUS_TIME_MINUTOS= "tiempo"
      - WELCOME_BANNER_URL= "banner recomendado 200x600"     
      - PUID= 
      - PGID= 
      - TZ=       
      - DB_HOST= 
      - DB_USER=
      - DB_PASSWORD=
      - DB_DATABASE=         
      - INSTAGRAM_FIX_URL=.
      - PIXIV_FIX_URL=
      - REDDIT_FIX_URL=
      - TIKTOK_FIX_URL=
      - TWITTER_FIX_URL=
      - YOUTUBE_FIX_URL=
      - BSKY_FIX_URL=
      - TWITCH_FIX_URL=
      - BILILI_FIX_URL=
      - THRENDS_FIX_URL=
      - DEVIAN_FIX_URL=
      - TUMBLR_FIX_URL=
      - FURAFF_FIX_URL=
      - IMGUR_FIX_URL=
      - IWARA_FIX_URL=
      - API_REPLACEMENT_DOMAINS= "Sitios soportados por https://embedez.com/"
      - BOT_STATUSES= "emoji | nombre | tipo de actividad"      
    volumes:
      - ./bot:/app/logs
    depends_on:
      - mariadb     
  
  mariadb:
    image: mariadb:latest
    restart: unless-stopped
    container_name:
    ports:
      - 3306:3306
    environment:
      - MYSQL_ROOT_PASSWORD=
      - MYSQL_USER=     
      - MYSQL_PASSWORD=
      - MYSQL_DATABASE=
      - PGID=
      - PUID=
    volumes:
      - ./db:/var/lib/mysql
```
[hub.docker.com](https://hub.docker.com/r/nowaru124/meltryllis)
---
Archivos en el Proyecto:
```
Meltryllis con Arma/
├── src/
│   ├── client/
│   │   ├── commands/
│   │   │   ├── embed.ts
│   │   │   ├── hola.ts
│   │   │   ├── owner.ts
│   │   │   ├── replybots.ts
│   │   │   ├── rolemoji.ts
│   │   │   ├── test.ts
│   │   │   ├── welcome.ts
│   │   │   └── work.ts
│   │   ├── events/
│   │   │   ├── rolemojiEvents.ts
│   │   │   └── welcomeEvents.ts
│   │   ├── database.ts
│   │   ├── index.ts
│   │   ├── setStatus.ts
│   │   └── upCommands.ts
│   ├── i18n/
│   │   ├── index.ts
│   │   └── langCmndVal.ts 
│   ├── remplazadores/
│   │   ├── webs/
│   │   │   ├── Bilibili.ts
│   │   │   ├── Bsky.ts
│   │   │   ├── DeviantArt.ts
│   │   │   ├── Facebook.ts
│   │   │   ├── Furaffinity.ts
│   │   │   ├── Imgur.ts
│   │   │   ├── Instagram.ts
│   │   │   ├── Iwara.ts
│   │   │   ├── Pixiv.ts
│   │   │   ├── Reddit.ts
│   │   │   ├── Threads.ts
│   │   │   ├── TikTok.ts
│   │   │   ├── Tumblr.ts
│   │   │   ├── Twitch.ts
│   │   │   ├── Twitter.ts
│   │   │   └── YouTube.ts
│   │   ├── ApiReplacement.ts
│   │   ├── EmbedingConfig.ts   
│   │   ├── index.ts
│   │   └── RuleReplacement.ts
│   ├── environment.ts
│   ├── index.ts
│   ├── logging.ts
│   ├── .env
│   ├── Dockerfile
│   ├── package-lock.json
│   ├── package.json
│   ├── tsconfig.json
│   └── tsconfig.prod.json
└── add/
    ├── /langs/
    │   └── locales/
    │       ├── es/
    │       │   └── *.json
    │       └── en/
    │           └── *.json
    └── /fonts/
        ├── Bitcount.ttf
        └── StoryScript-Regular.ttf
   
    
 ```
