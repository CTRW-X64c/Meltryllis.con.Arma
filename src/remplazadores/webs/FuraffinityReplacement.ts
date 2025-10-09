import BaseReplacement from "../BaseReplacement";

export default class FuraffinityReplacement extends BaseReplacement {
  constructor(newDomain: string) {
    super(
      newDomain,
    /https?:\/\/(www\.)?furaffinity\.net\/view\/[^\s]+/g,
      /(www\.)?(furaffinity\.net\/)/,
    );
  }
}

