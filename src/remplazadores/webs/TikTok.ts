// src/remplazadores/TikTok.ts
import Ruler from "../RuleReplacement";

export default class TikTok extends Ruler {
  constructor(newDomain: string) {
    super(newDomain, 
      /https?:\/\/(\w+\.)?tiktok\.com\/[^\s]+/g, 
      /tiktok\.com\//);
  }
}
