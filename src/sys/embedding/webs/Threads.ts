// src/sys/embeding/webs/Threads.ts
import Ruler from "../RuleReplacement";

export default class Threads extends Ruler {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(www\.)?threads\.com\/@?([\w.]{1,32})\/post\/([^\s?]+)(\?.*)?/g,
      /(\w+\.)?(threads\.com\/)/,
    );
  }
}