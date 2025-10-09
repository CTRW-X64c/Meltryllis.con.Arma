import BaseReplacement from "../BaseReplacement";

export default class BskyReplacement extends BaseReplacement {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/bsky\.app\/profile\/.*\/post\/[^\s]+/g,
      /bsky\.app\//,
    );
  }
}

