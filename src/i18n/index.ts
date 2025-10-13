// src/i18n/index.ts
import i18next from "i18next";
import I18NexFsBackend from "i18next-fs-backend";
import path from "path";

export async function initI18n(translate?: string): Promise<void> {
  await i18next.use(I18NexFsBackend).init({
    // Se elimina el .json y se añade el patch aqui.
    backend: {
      loadPath: path.join(__dirname, "../../adds/langs/{{lng}}/{{ns}}.json"),
      addPath: path.join(__dirname, "../../adds/langs/{{lng}}/missing.json"),
    },

    supportedLngs: ["es"],
    fallbackLng: "es",
    lng: translate || "es",
    ns: [ "sys", "core", "embed", "hola", "replybots", "rolemoji", "test", "welcome", "work", "common"],
    defaultNS: "common",
    interpolation: {
      escapeValue: false
    }
  });
}