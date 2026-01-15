// src/sys/embeding/webs/Tumblr.ts
import Ruler from "../RuleReplacement";

export default class Tumblr extends Ruler {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(www\.)?tumblr\.com\/((communities\/[\w-]+|[\w-]+)(?=\/|$)\/[^\s]+)/g,
      /(www\.)?tumblr\.com\/(communities\/|)/,
      true
    );
  }
}