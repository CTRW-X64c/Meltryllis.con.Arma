// src/i18n/index.ts
import i18next from "i18next";
import I18NexFsBackend from "i18next-fs-backend";
import path from "path";

export const SUPPORTED_LANGUAGES = process.env.LANGS_SUPPORTED?.split(",").map(lang => lang.trim()) || [];
export async function initI18n(locale?: string): Promise<void> {
  await i18next.use(I18NexFsBackend).init({
    // Se elimina el .json y se añade el patch aqui.
    backend: {
      loadPath: path.join(__dirname, "../../adds/langs/{{lng}}/{{ns}}.json"),
      addPath: path.join(__dirname, "../../adds/missing/{{lng}}_{{ns}}.json"),
    },

    supportedLngs: SUPPORTED_LANGUAGES,
    fallbackLng: "es",
    lng: locale || "es",
    ns: [ "core", "embed", "hola", "replybots", "rolemoji", "test", "welcome", "work", "youtube", "common"],
    defaultNS: "common",
    saveMissing: true,
    interpolation: {
      escapeValue: false
    }
  });
}