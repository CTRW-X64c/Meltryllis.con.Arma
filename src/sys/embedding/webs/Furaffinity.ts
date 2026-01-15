// src/sys/embeding/webs/Furaffinity.ts
import Ruler from "../RuleReplacement";

export default class Furaffinity extends Ruler {
  constructor(newDomain: string) {
    super(
      newDomain,
    /https?:\/\/(www\.)?furaffinity\.net\/view\/[^\s]+/g,
      /(www\.)?(furaffinity\.net\/)/,
    );
  }
}

