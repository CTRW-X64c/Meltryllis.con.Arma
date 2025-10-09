import BaseReplacement from "../BaseReplacement";

export default class TumblrReplacement extends BaseReplacement {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(www\.)?tumblr\.com\/((communities\/[\w-]+|[\w-]+)(?=\/|$)\/[^\s]+)/g,
      /(www\.)?tumblr\.com\/(communities\/|)/,
      true
    );
  }
}