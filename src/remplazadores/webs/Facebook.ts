// src/remplazadores/Facebook.ts
import Ruler from "../RuleReplacement";

export default class Facebook extends Ruler {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(www\.)?facebook\.com\/share\/r\/[^\s]+/g,
      /(www\.)?(facebook\.com\/)/,
    );
  }
}
