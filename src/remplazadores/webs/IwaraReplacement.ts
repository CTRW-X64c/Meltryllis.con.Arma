// src/remplazadores/InstagramReplacement.ts
import BaseReplacement from "../BaseReplacement";

export default class IwaraReplacement extends BaseReplacement {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(\w+\.)?iwara\.tv\/video\/(\w){1,15}\/[^\s]+/g,
      /(\w+\.)?(iwara\.tv\/)/,
      true,
    );
  }

  // Inherit replaceURLs from BaseReplacement
}