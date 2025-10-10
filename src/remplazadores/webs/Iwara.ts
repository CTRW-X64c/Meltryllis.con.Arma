// src/remplazadores/Iwara.ts
import Ruler from "../RuleReplacement";

export default class Iwara extends Ruler {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(\w+\.)?iwara\.tv\/video\/(\w){1,15}\/[^\s]+/g,
      /(\w+\.)?(iwara\.tv\/)/,
      true,
    );
  }
}