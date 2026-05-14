// src/sys/embeding/webs/FacebookV.ts
import Ruler from "../RuleReplacement";

export class FacebookVideolink extends Ruler {
    constructor(newDomain: string) {
        super(
            newDomain,
            /https?:\/\/(www\.)?facebook\.com\/[^\s]+/g,
            /(www\.)?facebook\.com\//,
            false,
        );
    }
}