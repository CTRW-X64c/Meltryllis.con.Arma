// src/sys/embeding/EmbedingConfig.ts
import Bilibili from "./webs/Bilibili";
import Bsky from "./webs/Bsky";
import DeviantArt from "./webs/DeviantArt";
import Facebook from "./webs/Facebook";
import Furaffinity from "./webs/Furaffinity";
import Imgur from "./webs/Imgur";
import Instagram from "./webs/Instagram";
import Iwara from "./webs/Iwara";
import Pixiv from "./webs/Pixiv";
import Reddit from "./webs/Reddit";
import Threads from "./webs/Threads";
import TikTok from "./webs/TikTok";
import Tumblr from "./webs/Tumblr";
import Twitch from "./webs/Twitch";
import Twitter from "./webs/Twitter";
//import YouTube from "./webs/YouTube";

interface ReplacementMeta {
  name: string;
  dbKey: string;
  Class: new (...args: any[]) => { replaceURLs: (content: string) => string | null };
  regexKeys: string;
}

export const rMetaList: ReplacementMeta[] = [
  {
    name: "Bilibili",
    dbKey: "bilibili",
    Class: Bilibili,
    regexKeys: "(\\/\\/|\\.)?bilibili\\.com",
  },
  {
    name: "Bluesky",
    dbKey: "bluesky",
    Class: Bsky,
    regexKeys: "(\\/\\/|\\.)?bsky\\.app",
  },
  {
    name: "Deviantart",
    dbKey: "deviantart",
    Class: DeviantArt,
    regexKeys: "(\\/\\/|\\.)?deviantart\\.com/",
  },
  {
    name: "Facebook",
    dbKey: "facebook",
    Class: Facebook,
    regexKeys: "(\\/\\/|\\.)?(facebook|fb)\\.com\\/.*",
  },
  {
    name: "Furaffinity",
    dbKey: "furaffinity",
    Class: Furaffinity,
    regexKeys: "(\\/\\/|\\.)?furaffinity\\.net/",
  },
  {
    name: "Imgur",
    dbKey: "imgur",
    Class: Imgur,
    regexKeys: "(\\/\\/|\\.)?imgur\\.com/",
  },
  {
    name: "Intagram",
    dbKey: "instagram",
    Class: Instagram,
    regexKeys: "\\/\\/(\\w+\\.)?instagram.com\\/(p|reels?|stories)\\/",
  },
  {
    name: "Iwara",
    dbKey: "iwara",
    Class: Iwara,
    regexKeys: "(\\/\\/|\\.)?iwara\\.tv/",
  },
  {
    name: "Pixiv",
    dbKey: "pixiv",
    Class: Pixiv,
    regexKeys: "https?:\\/\\/(\\w+\\.)?pixiv\\.net\\/(\\w+\\/)?(artworks|member_illust\\.php)(\\/|\\?illust_id=)\\d+(\\/?\\d+)?",
  },
  {
    name: "Reddit",
    dbKey: "reddit",
    Class: Reddit,
    regexKeys: "\\/\\/(\\w+\\.)?(reddit.com|redd.it)\\/(r|u|user)\\/\\w+\\/(s|comments)\\/\\w+",
  },
  {
    name: "Threads",
    dbKey: "threads",
    Class: Threads,
    regexKeys: "(\\/\\/|\\.)?threads\\.com/",
  },
  {
    name: "Tiktok",
    dbKey: "tiktok",
    Class: TikTok,
    regexKeys: "\\/\\/(\\w+\\.)?tiktok.com\\/((t\\/)?\\w+|@[^\\s]+\\/video)",
  },
  {
    name: "Tumblr",
    dbKey: "tumblr",
    Class: Tumblr,
    regexKeys: "(\\/\\/|\\.)?tumblr\\.com/",
  },
  {
    name: "Twitch",
    dbKey: "twitch",
    Class: Twitch,
    regexKeys: "(\\/\\/|\\.)?twitch\\.tv",
  },
  {
    name: "Twitter | X",
    dbKey: "twitter",
    Class: Twitter,
    regexKeys: "(\\/\\/|\\.)(x|twitter)\\.com",
  },
  /*{
    name: "Youtube",
    dbKey: "youtube",
    Class: YouTube,
    regexKeys: ["(m|www)\\.youtube\\.com/shorts/"],
  },*/
];
