// src/remplazadores/replacementConfigs.ts
import BilibiliReplacement from "./webs/BilibiliReplacement";
import BskyReplacement from "./webs/BskyReplacement";
import DeviantArtReplacement from "./webs/DeviantArtReplacement";
import FacebookReplacement from "./webs/FacebookReplacement";
import FuraffinityReplacement from "./webs/FuraffinityReplacement";
import ImgurReplacement from "./webs/ImgurReplacement";
import InstagramReplacement from "./webs/InstagramReplacement";
import IwaraReplacement from "./webs/IwaraReplacement";
import PixivReplacement from "./webs/PixivReplacement";
import RedditReplacement from "./webs/RedditReplacement";
import ThreadsReplacement from "./webs/ThreadsReplacement";
//import TikTokReplacement from "./webs/TikTokReplacement";
import TumblrReplacement from "./webs/TumblrReplacement";
import TwitchReplacement from "./webs/TwitchReplacement";
import TwitterReplacement from "./webs/TwitterReplacement";
import YouTubeReplacement from "./webs/YouTubeReplacement";

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
    Class: BilibiliReplacement,
    regexKeys: ["(\\/\\/|\\.)?bilibili\\.com"],
    takesUrl: true,
  },
  {
    name: "Bluesky",
    envVar: "BSKY_FIX_URL",
    Class: BskyReplacement,
    regexKeys: ["(\\/\\/|\\.)?bsky\\.app"],
    takesUrl: true,
  },
  {
    name: "Deviantart",
    envVar: "DEVIAN_FIX_URL",
    Class: DeviantArtReplacement,
    regexKeys: ["(\\/\\/|\\.)?deviantart\\.com/"],
    takesUrl: true,
  },
  {
    name: "Facebook",
    envVar: "FACEBOOK_FIX_URL",
    Class: FacebookReplacement,
    regexKeys: ["(\\/\\/|\\.)?facebook\\.com/share/r/"],
    takesUrl: true,
  },
  {
    name: "Furaffinity",
    envVar: "FURAFF_FIX_URL",
    Class: FuraffinityReplacement,
    regexKeys: ["(\\/\\/|\\.)?furaffinity\\.net/"],
    takesUrl: true,
  },
  {
    name: "Imgur",
    envVar: "IMGUR_FIX_URL",
    Class: ImgurReplacement,
    regexKeys: ["(\\/\\/|\\.)?imgur\\.com/"],
    takesUrl: true,
  },
  {
    name: "Intagram",
    envVar: "INSTAGRAM_FIX_URL",
    Class: InstagramReplacement,
    regexKeys: ["\\/\\/(\\w+\\.)?instagram.com\\/(p|reel|stories)\\/"],
    takesUrl: true,
  },
  {
    name: "Iwara",
    envVar: "IWARA_FIX_URL",
    Class: IwaraReplacement,
    regexKeys: ["(\\/\\/|\\.)?iwara\\.tv/"],
    takesUrl: true,
  },
  {
    name: "Pixiv",
    envVar: "PIXIV_FIX_URL",
    Class: PixivReplacement,
    regexKeys: ["https?:\\/\\/(\\w+\\.)?pixiv\\.net\\/(\\w+\\/)?(artworks|member_illust\\.php)(\\/|\\?illust_id=)\\d+(\\/?\\d+)?"],
    takesUrl: true,
  },
  {
    name: "Reddit",
    envVar: "REDDIT_FIX_URL",
    Class: RedditReplacement,
    regexKeys: [
      "\\/\\/(\\w+\\.)?reddit\\.com\\/(r|u|user)\\/\\w+\\/(s|comments)\\/\\w+",
      "\\/\\/redd\\.it/",
    ],
    takesUrl: true,
  },
  {
    name: "Threads",
    envVar: "THRENDS_FIX_URL",
    Class: ThreadsReplacement,
    regexKeys: ["(\\/\\/|\\.)?threads\\.com/"],
    takesUrl: true,
  },
/**   {
    name: "Tiktok",
    envVar: "TIKTOK_FIX_URL",
    Class: TikTokReplacement,
    regexKeys: ["\\/\\/(\\w+\\.)?tiktok.com\\/((t\\/)?\\w+|@[^\\s]+\\/video)"],
    takesUrl: true,
  },
  */
  {
    name: "Tumblr",
    envVar: "TUMBLR_FIX_URL",
    Class: TumblrReplacement,
    regexKeys: ["(\\/\\/|\\.)?tumblr\\.com/"],
    takesUrl: true,
  },
  {
    name: "Twitch",
    envVar: "TWITCH_FIX_URL",
    Class: TwitchReplacement,
    regexKeys: ["(\\/\\/|\\.)?twitch\\.tv"],
    takesUrl: true,
  },
  {
    name: "Twitter | X",
    envVar: "TWITTER_FIX_URL",
    Class: TwitterReplacement,
    regexKeys: ["(\\/\\/|\\.)(x|twitter)\\.com"],
    takesUrl: true,
  },
  {
    name: "Youtube",
    envVar: "YOUTUBE_FIX_URL",
    Class: YouTubeReplacement,
    regexKeys: ["(m|www)\\.youtube\\.com/shorts/"],
    takesUrl: true,
  },
];

