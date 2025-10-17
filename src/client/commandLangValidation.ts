// src/client/commandLangValidation.ts
import i18next from "i18next";
import { SUPPORTED_LANGUAGES } from "../i18n";

type TranslationConfig = {
    [namespace: string]: string[];
};

const TRANSLATIONS_TO_VALIDATE: TranslationConfig = {
    "rolemoji": [
        "command_rolemoji_description",
        "command_rolemoji_assign_description",
        "command_rolemoji_message_id_description", 
        "command_rolemoji_emoji_description",
        "command_rolemoji_role_description",
        "command_rolemoji_remove_description",
        "command_rolemoji_remove_id_description",
        "command_rolemoji_list_description"
    ],
    "hola": [
        "command_hola_description"
    ]
    // Agrega más namespaces según necesites
};

export async function validateAllTranslations(): Promise<void> {
    console.log("🔍 Validando traducciones por idioma...\n");
    
    let totalErrors = 0;
    const missingTranslations: string[] = [];

    for (const language of SUPPORTED_LANGUAGES) {
        console.log(`🌐 Validando idioma: ${language.toUpperCase()}`);
        let languageErrors = 0;

        await i18next.changeLanguage(language);
        
        for (const [namespace, keys] of Object.entries(TRANSLATIONS_TO_VALIDATE)) {
            let namespaceErrors = 0;
            let namespaceMissing = 0;
            
            keys.forEach(key => {
                const translationExists = i18next.exists(key, { ns: namespace });
                
                if (!translationExists) {
                    totalErrors++;
                    languageErrors++;
                    namespaceMissing++;
                    missingTranslations.push(`${language}/${namespace}.${key}`);
                    console.error(`   ❌ ${namespace}.${key} - NO EXISTE en ${language}`);
                    return;
                }
                
                const translation = i18next.t(key, { ns: namespace });
                
                if (translation.length > 100) {
                    totalErrors++;
                    languageErrors++;
                    namespaceErrors++;
                    
                    console.error(`   ❌ NS:${namespace} Llave: ${key} - DEMASIADO LARGO`);
                    console.error(`       Longitud: ${translation.length}/100`);
                    console.error(`       Archivo: adds/langs/${language}/${namespace}.json`);
                    console.error(`       Contenido: "${translation}"`);
                }
            });

            if (namespaceErrors === 0 && namespaceMissing === 0) {
                console.log(`   ✅ ${namespace} - OK`);
            } else if (namespaceMissing > 0) {
                console.log(`   ⚠️  ${namespace} - ${namespaceMissing} clave(s) faltante(s)`);
            }
        }
        
        if (languageErrors === 0) {
            console.log(`   ✅ Idioma ${language} - SIN ERRORES\n`);
        } else {
            console.log(`   ❌ Idioma ${language} - ${languageErrors} error(es)\n`);
        }
    }
    
    // Resumen final
    console.log("=" .repeat(50));
    if (totalErrors > 0) {
        console.error(`💥 RESUMEN: Se encontraron ${totalErrors} errores`);
        
        if (missingTranslations.length > 0) {
            console.error("\n📋 Traducciones faltantes:");
            missingTranslations.forEach(missing => {
                console.error(`   - ${missing}`);
            });
        }
        
        console.error("\n🚫 Corrige los errores antes de continuar");
        process.exit(1);
    } else {
        console.log("✅ RESUMEN: Todas las traducciones son válidas");
    }
}