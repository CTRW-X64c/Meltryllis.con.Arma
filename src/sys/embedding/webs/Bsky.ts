// src/sys/embeding/webs/Bsky.ts
import Ruler from "../RuleReplacement";

export default class Bsky extends Ruler {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/bsky\.app\/profile\/.*\/post\/[^\s]+/g,
      /bsky\.app\//,
    );
  }
}

