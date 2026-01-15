// src/sys/embeding/webs/Imgur.ts
import Ruler from "../RuleReplacement";

export default class Imgur extends Ruler {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/imgur\.com\/gallery\/[^\s]+/g,
      /imgur\.com\//,
    );
  }
}


