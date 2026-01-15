// src/sys/embeding/webs/Twitter.ts
import Ruler from "../RuleReplacement";

export default class Twitter extends Ruler {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(x|twitter)\.com\/(\w){1,15}\/status\/[^\s]+/g,
      /(x|twitter)\.com\//,
    );
  }
}
