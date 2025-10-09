import BaseReplacement from "../BaseReplacement";

export default class DeviantArtReplacement extends BaseReplacement {
  constructor(newDomain: string) {
    super(
      newDomain,
    /https?:\/\/(www\.)?deviantart\.com\/(\w){1,32}\/art\/[^\s]+/g,
      /(www\.)?(deviantart\.com\/)/,
    );
  }
}
