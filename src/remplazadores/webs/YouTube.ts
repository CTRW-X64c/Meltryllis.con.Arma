// src/remplazadores/YouTube.ts
import Ruler from "../RuleReplacement";

export default class YouTube extends Ruler {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(www\.)?youtube\.com\/shorts\/[^\s]+/g,
      /(www\.)?(youtube\.com\/shorts\/)/,
    );
  }
}
