// src/remplazadores/replacementConfigs.ts
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
//import TikTok from "./webs/TikTok";
import Tumblr from "./webs/Tumblr";
import Twitch from "./webs/Twitch";
import Twitter from "./webs/Twitter";
import YouTube from "./webs/YouTube";

export interface ReplacementMeta {
  name: string;
  envVar: string;
  Class: new (...args: any[]) => { replaceURLs: (content: string, base?: string) => string | null };
  regexKeys: string[];
  dependsOn?: string;
  takesUrl: boolean;
}

export const replacementMetaList: ReplacementMeta[] = [
  {
    name: "Bilibili",
    envVar: "BILILI_FIX_URL",
    Class: Bilibili,
    regexKeys: ["(\\/\\/|\\.)?bilibili\\.com"],
    takesUrl: true,
  },
  {
    name: "Bluesky",
    envVar: "BSKY_FIX_URL",
    Class: Bsky,
    regexKeys: ["(\\/\\/|\\.)?bsky\\.app"],
    takesUrl: true,
  },
  {
    name: "Deviantart",
    envVar: "DEVIAN_FIX_URL",
    Class: DeviantArt,
    regexKeys: ["(\\/\\/|\\.)?deviantart\\.com/"],
    takesUrl: true,
  },
  {
    name: "Facebook",
    envVar: "FACEBOOK_FIX_URL",
    Class: Facebook,
    regexKeys: ["(\\/\\/|\\.)?facebook\\.com/share/r/"],
    takesUrl: true,
  },
  {
    name: "Furaffinity",
    envVar: "FURAFF_FIX_URL",
    Class: Furaffinity,
    regexKeys: ["(\\/\\/|\\.)?furaffinity\\.net/"],
    takesUrl: true,
  },
  {
    name: "Imgur",
    envVar: "IMGUR_FIX_URL",
    Class: Imgur,
    regexKeys: ["(\\/\\/|\\.)?imgur\\.com/"],
    takesUrl: true,
  },
  {
    name: "Intagram",
    envVar: "INSTAGRAM_FIX_URL",
    Class: Instagram,
    regexKeys: ["\\/\\/(\\w+\\.)?instagram.com\\/(p|reel|stories)\\/"],
    takesUrl: true,
  },
  {
    name: "Iwara",
    envVar: "IWARA_FIX_URL",
    Class: Iwara,
    regexKeys: ["(\\/\\/|\\.)?iwara\\.tv/"],
    takesUrl: true,
  },
  {
    name: "Pixiv",
    envVar: "PIXIV_FIX_URL",
    Class: Pixiv,
    regexKeys: ["https?:\\/\\/(\\w+\\.)?pixiv\\.net\\/(\\w+\\/)?(artworks|member_illust\\.php)(\\/|\\?illust_id=)\\d+(\\/?\\d+)?"],
    takesUrl: true,
  },
  {
    name: "Reddit",
    envVar: "REDDIT_FIX_URL",
    Class: Reddit,
    regexKeys: [
      "\\/\\/(\\w+\\.)?reddit\\.com\\/(r|u|user)\\/\\w+\\/(s|comments)\\/\\w+",
      "\\/\\/redd\\.it/",
    ],
    takesUrl: true,
  },
  {
    name: "Threads",
    envVar: "THRENDS_FIX_URL",
    Class: Threads,
    regexKeys: ["(\\/\\/|\\.)?threads\\.com/"],
    takesUrl: true,
  },
/**   {
    name: "Tiktok",
    envVar: "TIKTOK_FIX_URL",
    Class: TikTok,
    regexKeys: ["\\/\\/(\\w+\\.)?tiktok.com\\/((t\\/)?\\w+|@[^\\s]+\\/video)"],
    takesUrl: true,
  },
  */
  {
    name: "Tumblr",
    envVar: "TUMBLR_FIX_URL",
    Class: Tumblr,
    regexKeys: ["(\\/\\/|\\.)?tumblr\\.com/"],
    takesUrl: true,
  },
  {
    name: "Twitch",
    envVar: "TWITCH_FIX_URL",
    Class: Twitch,
    regexKeys: ["(\\/\\/|\\.)?twitch\\.tv"],
    takesUrl: true,
  },
  {
    name: "Twitter | X",
    envVar: "TWITTER_FIX_URL",
    Class: Twitter,
    regexKeys: ["(\\/\\/|\\.)(x|twitter)\\.com"],
    takesUrl: true,
  },
  {
    name: "Youtube",
    envVar: "YOUTUBE_FIX_URL",
    Class: YouTube,
    regexKeys: ["(m|www)\\.youtube\\.com/shorts/"],
    takesUrl: true,
  },
];

