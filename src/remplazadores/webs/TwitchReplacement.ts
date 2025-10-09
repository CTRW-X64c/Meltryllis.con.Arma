import BaseReplacement from "../BaseReplacement";

export default class YouTubeReplacement extends BaseReplacement {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(www\.)?twitch\.tv\/(\w){1,32}\/clip\/[^\s]+/g,
      /(www\.)?(twitch\.tv\/(\w){1,32}\/)/,
    );
  }
}
