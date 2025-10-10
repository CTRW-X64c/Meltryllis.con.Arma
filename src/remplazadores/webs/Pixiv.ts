// src/remplazadores/Pixiv.ts
import Ruler from "../RuleReplacement";

export default class Pixiv extends Ruler {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(\w+\.)?pixiv\.net\/(\w+\/)?(artworks|member_illust\.php)(\/|\?illust_id=)\d+(\/?\d+)?[^\s]+/g,
      /(\w+\.)?(pixiv\.net\/)/,
      false,
    );
  }
}
