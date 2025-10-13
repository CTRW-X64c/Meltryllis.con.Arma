// src/remplazadores/Instagram.ts
import Ruler from "../RuleReplacement";

export default class Instagram extends Ruler {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(\w+\.)?instagram\.com\/(p|reels?|stories)\/[^\s]+/g,
      /(\w+\.)?(instagram\.com\/)/,
    );
  }

}