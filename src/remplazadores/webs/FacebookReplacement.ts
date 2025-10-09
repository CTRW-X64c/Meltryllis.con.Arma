import BaseReplacement from "../BaseReplacement";

export default class FacebookReplacement extends BaseReplacement {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(www\.)?facebook\.com\/share\/r\/[^\s]+/g,
      /(www\.)?(facebook\.com\/)/,
    );
  }
}
