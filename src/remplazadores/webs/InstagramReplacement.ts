// src/remplazadores/InstagramReplacement.ts
import BaseReplacement from "../BaseReplacement";

export default class InstagramReplacement extends BaseReplacement {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(\w+\.)?instagram\.com\/(p|reel|stories)\/[^\s]+/g,
      /(\w+\.)?(instagram\.com\/)/,
    );
  }

  // Inherit replaceURLs from BaseReplacement
}