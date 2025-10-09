import BaseReplacement from "../BaseReplacement";

export default class ThreadsReplacement extends BaseReplacement {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(www\.)?threads\.com\/@?([\w.]{1,32})\/post\/([^\s?]+)(\?.*)?/g,
      /(\w+\.)?(threads\.com\/)/,
    );
  }
}