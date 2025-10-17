// src/i18n/index.ts
import i18next from "i18next";
import I18NexFsBackend from "i18next-fs-backend";
import path from "path";

export const SUPPORTED_LANGUAGES = ["es", "en"];
export async function initI18n(locale?: string): Promise<void> {
  await i18next.use(I18NexFsBackend).init({
    // Se elimina el .json y se añade el patch aqui.
    backend: {
      loadPath: path.join(__dirname, "../../adds/langs/{{lng}}/{{ns}}.json"),
      addPath: path.join(__dirname, "../../adds/langs/{{lng}}/missing.json"),
    },

    supportedLngs: SUPPORTED_LANGUAGES,
    fallbackLng: "es",
    lng: locale || "es",
    ns: [ "sys", "core", "embed", "hola", "replybots", "rolemoji", "test", "welcome", "work", "common"],
    defaultNS: "common",
    interpolation: {
      escapeValue: false
    }
  });
}