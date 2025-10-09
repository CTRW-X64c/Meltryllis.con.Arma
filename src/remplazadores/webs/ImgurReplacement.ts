import BaseReplacement from "../BaseReplacement";

export default class ImgurReplacement extends BaseReplacement {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/imgur\.com\/gallery\/[^\s]+/g,
      /imgur\.com\//,
    );
  }
}


