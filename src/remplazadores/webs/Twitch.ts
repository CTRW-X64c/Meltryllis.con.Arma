// src/remplazadores/Twitch.ts
import Ruler from "../RuleReplacement";

export default class Twitch extends Ruler {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(www\.)?twitch\.tv\/(\w){1,32}\/clip\/[^\s]+/g,
      /(www\.)?(twitch\.tv\/(\w){1,32}\/)/,
    );
  }
}
