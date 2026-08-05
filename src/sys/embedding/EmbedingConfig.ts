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
  Class: new (...args: any[]) => { replaceURLs: (content: string, base?: string) => string | null };
  regexKeys: string[];
  dependsOn?: string;
  takesUrl: boolean;
}

export const replacementMetaList: ReplacementMeta[] = [
  {
    name: "Bilibili",
    dbKey: "bilibili",
    Class: Bilibili,
    regexKeys: ["(\\/\\/|\\.)?bilibili\\.com"],
    takesUrl: true,
  },
  {
    name: "Bluesky",
    dbKey: "bluesky",
    Class: Bsky,
    regexKeys: ["(\\/\\/|\\.)?bsky\\.app"],
    takesUrl: true,
  },
  {
    name: "Deviantart",
    dbKey: "deviantart",
    Class: DeviantArt,
    regexKeys: ["(\\/\\/|\\.)?deviantart\\.com/"],
    takesUrl: true,
  },/*
  {
    name: "FacebookVideo",
    dbKey: "facebookVideo",
    Class: Facebook,
    regexKeys: ["(\\/\\/|\\.)?(facebook|fb)\\.com\\/(share\\/)?(r\\/|v\\/|reel\\/|watch\\?v=|\\d+\\/videos\\/)"],
    takesUrl: true,
  },*/
  {
    name: "Facebook",
    dbKey: "facebook",
    Class: Facebook,
    regexKeys: ["(\\/\\/|\\.)?(facebook|fb)\\.com\\/.*"],
    takesUrl: true,
  },
  {
    name: "Furaffinity",
    dbKey: "furaffinity",
    Class: Furaffinity,
    regexKeys: ["(\\/\\/|\\.)?furaffinity\\.net/"],
    takesUrl: true,
  },
  {
    name: "Imgur",
    dbKey: "imgur",
    Class: Imgur,
    regexKeys: ["(\\/\\/|\\.)?imgur\\.com/"],
    takesUrl: true,
  },
  {
    name: "Intagram",
    dbKey: "instagram",
    Class: Instagram,
    regexKeys: ["\\/\\/(\\w+\\.)?instagram.com\\/(p|reels?|stories)\\/"],
    takesUrl: true,
  },
  {
    name: "Iwara",
    dbKey: "iwara",
    Class: Iwara,
    regexKeys: ["(\\/\\/|\\.)?iwara\\.tv/"],
    takesUrl: true,
  },
  {
    name: "Pixiv",
    dbKey: "pixiv",
    Class: Pixiv,
    regexKeys: ["https?:\\/\\/(\\w+\\.)?pixiv\\.net\\/(\\w+\\/)?(artworks|member_illust\\.php)(\\/|\\?illust_id=)\\d+(\\/?\\d+)?"],
    takesUrl: true,
  },
  {
    name: "Reddit",
    dbKey: "reddit",
    Class: Reddit,
    regexKeys: [
      "\\/\\/(\\w+\\.)?reddit\\.com\\/(r|u|user)\\/\\w+\\/(s|comments)\\/\\w+",
      "\\/\\/redd\\.it/",
    ],
    takesUrl: true,
  },
  {
    name: "Threads",
    dbKey: "threads",
    Class: Threads,
    regexKeys: ["(\\/\\/|\\.)?threads\\.com/"],
    takesUrl: true,
  },
  {
    name: "Tiktok",
    dbKey: "tiktok",
    Class: TikTok,
    regexKeys: ["\\/\\/(\\w+\\.)?tiktok.com\\/((t\\/)?\\w+|@[^\\s]+\\/video)"],
    takesUrl: true,
  },
  {
    name: "Tumblr",
    dbKey: "tumblr",
    Class: Tumblr,
    regexKeys: ["(\\/\\/|\\.)?tumblr\\.com/"],
    takesUrl: true,
  },
  {
    name: "Twitch",
    dbKey: "twitch",
    Class: Twitch,
    regexKeys: ["(\\/\\/|\\.)?twitch\\.tv"],
    takesUrl: true,
  },
  {
    name: "Twitter | X",
    dbKey: "twitter",
    Class: Twitter,
    regexKeys: ["(\\/\\/|\\.)(x|twitter)\\.com"],
    takesUrl: true,
  },
  /*{
    name: "Youtube",
    dbKey: "youtube",
    Class: YouTube,
    regexKeys: ["(m|www)\\.youtube\\.com/shorts/"],
    takesUrl: true,
  },*/
];
