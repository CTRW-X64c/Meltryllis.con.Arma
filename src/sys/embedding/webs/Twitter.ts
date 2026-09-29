import Ruler from "../RuleReplacement";

export default class Twitter extends Ruler {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(?:x|twitter)\.com\/(\w){1,15}\/status\/[^\s]+/gi,
      /(x|twitter)\.com\//,
    );
  }

  public replaceURLs: (messageContent: string, domainFilter?: string) => string | null = (messageContent) => {
    const matches = messageContent.match(this.matchRegex);
    if (!matches || matches.length === 0) { return null; }

    const fixLang = matches.map((url) => {
      const lngMatch = url.match(/\/([a-z]{2}(?:-[a-z]{2})?)(?=\?|#|$)/);
      const suffix = lngMatch ? ('/' + lngMatch[1]) : "";

      let base = url.split(/[?#]/)[0];
      if (suffix && base.endsWith(suffix)) { base = base.slice(0, -suffix.length); }

      const newDomain = "https://www." + this.newDomain + '/';
      return base.replace(/https?:\/\/(?:x|twitter)\.com\//, newDomain) + suffix;
    });

    return fixLang.join('\n');
  };
}