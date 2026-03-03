// src/sys/i18n/langCmndVal.ts
import i18next from "i18next";
import { SUPPORTED_LANGUAGES } from "./index";
import { error, info } from "../logging"

type TranslationConfig = {
    [namespace: string]: string[];
};

const TRANSLATIONS_TO_VALIDATE: TranslationConfig = {
//Agrega todos los i18next.t que esten dentro de la funcion "SlashCommandBuilder"
    "help":[
        "comBuild.*"
    ],
    "embSys":[
        "test.slashBuilder.*",
        "work.slashBuilder.*",
        "embed.slashBuilder.*"
    ],
    "botones":[
        "buttonLink.slashbuilder.*",
        "roleButton.slashbuilder.*"
    ],
    "follows":[
        "mangadex.slashbuilder.*",
        "reddit.slashBuilder.*",
        "youtube.slashBuilder.*"
    ],
    "commands":[
        "joinCreate.slashBuilder.*",
        "cleanup.slashBuilder.*",
        "mussic.slashBuilder.*",
        "permisos.slashBuilder.*",
        "post.slashBuilder.*",
        "rolemoji.slashBuilder.*",
        "welcome.slashBuilder.*"
    ],

    // Agrega más namespaces según necesites
};

export async function validateAllTranslations(): Promise<void> {
    info("🔍 Validando las traducciones de los comandos...");
    
    let totalErrors = 0;
    const missingTranslations: string[] = [];

    const collectLeafKeys = (obj: any, prefix: string): string[] => {
        if (obj === null || typeof obj !== 'object') {
            return [];
        }
    
        return Object.keys(obj).flatMap(key => {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            const value = obj[key];
            if (typeof value === 'object' && value !== null) {
                return collectLeafKeys(value, fullKey);
            }
            return fullKey;
        });
    }

    const getKeysFromPath = (lng: string, ns: string, path: string): string[] => {
        const resource = i18next.getResourceBundle(lng, ns);
        if (!resource) return [];
    
        const pathPrefix = path.replace('.*', '');
        let obj = resource;
    
        if (pathPrefix) {
            const pathParts = pathPrefix.split('.');
            for (const part of pathParts) {
                if (typeof obj !== 'object' || obj === null || !obj[part]) return [];
                obj = obj[part];
            }
        }
    
        return collectLeafKeys(obj, pathPrefix);
    };

    for (const language of SUPPORTED_LANGUAGES) {
        info(`🌐 Validando idioma: ${language.toUpperCase()}`);
        let languageErrors = 0;

        await i18next.changeLanguage(language);
        
        for (const [namespace, keys] of Object.entries(TRANSLATIONS_TO_VALIDATE)) {
            let namespaceErrors = 0;
            let namespaceMissing = 0;
            
            const expandedKeys = keys.flatMap(key => {
                if (key.endsWith('.*')) {
                    return getKeysFromPath(language, namespace, key);
                }
                return key;
            });

            expandedKeys.forEach(key => {
                const translationExists = i18next.exists(key, { ns: namespace });
                
                if (!translationExists) {
                    totalErrors++;
                    languageErrors++;
                    namespaceMissing++;
                    missingTranslations.push(`${language}/${namespace}.${key}`);
                    error(`   ❌ ${namespace}.${key} - NO EXISTE en ${language}`);
                    return;
                }
                
                const translation = i18next.t(key, { ns: namespace });
                
                if (translation.length > 100) {
                    totalErrors++;
                    languageErrors++;
                    namespaceErrors++;
                    
                    error(`   ❌ NS:${namespace} Llave: ${key} - DEMASIADO LARGO`);
                    error(`       Longitud: ${translation.length}/100`);
                    error(`       Archivo: adds/langs/${language}/${namespace}.json`);
                    error(`       Contenido: "${translation}"`);
                }
            });

            if (namespaceErrors === 0 && namespaceMissing === 0) {
                info(`   ✅ ${namespace} - OK`);
            } else if (namespaceMissing > 0) {
                info(`   ⚠️  ${namespace} - ${namespaceMissing} clave(s) faltante(s)`);
            }
        }
        
        if (languageErrors === 0) {
            info(`   ✅ Idioma ${language} - SIN ERRORES`);
        } else {
            info(`   ❌ Idioma ${language} - ${languageErrors} error(es)`);
        }
    }
    
    if (totalErrors > 0) {
        error(`💥 RESUMEN: Se encontraron ${totalErrors} errores`);
        
        if (missingTranslations.length > 0) {
            error("📋 Traducciones faltantes:");
            missingTranslations.forEach(missing => {
                error(`   - ${missing}`);
            });
        }
        
        error("🚫 Corrige los errores antes de continuar\n");
        process.exit(1);
    } else {
        info("✅ RESUMEN: Todas las traducciones son válidas\n");
    }
}