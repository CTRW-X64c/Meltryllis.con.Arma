// src/remplazadores/DeviantArt.ts
import Ruler from "../RuleReplacement";

export default class DeviantArt extends Ruler {
  constructor(newDomain: string) {
    super(
      newDomain,
    /https?:\/\/(www\.)?deviantart\.com\/(\w){1,32}\/art\/[^\s]+/g,
      /(www\.)?(deviantart\.com\/)/,
    );
  }
}
