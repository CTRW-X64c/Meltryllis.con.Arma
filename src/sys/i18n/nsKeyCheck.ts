// src/sys/i18n/langCmndVal.ts
import i18next from "i18next";
import { SUPPORTED_LANGUAGES } from "./index";
import { error, info } from "../logging"

type TranslationConfig = {
    [namespace: string]: string[];
};

const TRANSLATIONS_TO_VALIDATE: TranslationConfig = {
//Agrega todos los i18next.t que esten dentro de la funcion "SlashCommandBuilder"
    "embed":[
        "command_embed_description",
        "command_embed_config",
        "embed_command_site_description",
        "embed_command_action_description",
        "subcommand_enable",
        "subcommand_disable",
        "subcommand_custom",
        "subcommand_default",
        "embed_command_custom_url"
    ],    
    "hola":[
        "command_hola_description"
    ], 
    "rolemoji":[
        "command_rolemoji_description",
        "command_rolemoji_assign_description",
        "command_rolemoji_message_id_description", 
        "command_rolemoji_emoji_description",
        "command_rolemoji_role_description",
        "command_rolemoji_remove_description",
        "command_rolemoji_remove_id_description",
        "command_rolemoji_list_description",
        "command_rolemoji_help_title",
        "command_rolemoji_help_description"
    ],
    "test":[
        "command_test_description",
        "test_command_mode_description",
        "test_permission_guild",
        "test_work_by_channel",
        "test_show_embed_config",
        "test_commands_mode_domainds"
    ],
    "welcome":[
        "command_welcome_description",
        "command_welcome_config_description",
        "command_welcome_channel_description",
        "command_welcome_enabled_description",
        "command_welcome_message_description"
    ],
    "work":[
        "work_command_description",
        "work_command_state_description",
        "work_command_mode_description"
    ],
    "youtube":[
        "command_youtube",
        "command_youtube_descripcion",
        "command_youtube_seguir",
        "command_youtube_canal",
        "command_youtube_lista",
        "command_youtube_dejar",
        "command_youtube_id_canal",
        "command_youtube_test",
        "command_youtube_test_id_canal",
        "command_youtube_help"
    ],
    "reddit":[
        "command_reddit",
        "command_reddit_descripcion",
        "command_reddit_seguir",
        "command_reddit_canal",
        "command_reddit_filtro",
        "command_reddit_sin_filtro",
        "command_reddit_filtro_multimedia",
        "command_reddit_filtro_texto",
        "command_reddit_lista",
        "command_reddit_id_canal",
        "command_reddit_dejar",
        "command_reddit_test",
        "command_reddit_help"
    ],
    "post":[
        "command_post_description",
        "command_post_post_msg_description",
        "command_post_canal_description",
        "command_post_copy_description",
        "command_post_mensaje_description",
        "command_post_canal_origen_description",
        "command_post_edit_description",
        "command_post_mensaje_edit_description",
        "command_post_nuevo_mensaje_description",
        "command_post_borrar_msg_description",
        "command_post_borrar_copy_description",
        "command_post_borrar_edit_description",
        "command_post_borrar_reply_description"
    ],
    "cleanup":[
        "command_cleanup_description",
        "command_cleanup_start_description",
        "command_cleanup_before_option",
        "command_cleanup_after_option",
        "command_cleanup_message_id_description",
        "command_cleanup_count_description",
        "command_cleanup_type_description",
        "command_cleanup_users_option",
        "command_cleanup_bots_option",
        "command_cleanup_any_option"
    ],
    "jointocreate":[
        "command_jointocreate_description",
        "command_jointocreate_set_description",
        "command_jointocreate_canal_description",
        "command_jointocreate_disable_description",
        "command_jointocreate_status_description",
        "command_jointocreate_cleanup_description",
        "command_jointocreate_forzar_description"
    ],
    "mangadex":[
        "command_mangadex",
        "command_mangadex_descripcion",
        "command_mangadex_seguir",
        "command_mangadex_canal",
        "command_mangadex_idioma",
        "command_mangadex_lista_desc",
        "command_mangadex_dejar_desc",
        "command_mangadex_dejar_url",
        "command_mangadex_ayuda_desc"
    ],
    "permissions":[
        "command_permissions_description",
        "command_permissions_add_description",
        "command_permissions_add_option_description",
        "command_permissions_add_description",
        "command_permissions_option_rol",
        "command_permissions_option_usuario",
        "command_permissions_remove_description",
        "command_permissions_remove_option_description",
        "command_permissions_list_description",
        "command_permissions_list_option_description",
        "command_permissions_list_option_detallado",
        "command_permissions_clear_description",
        "command_permissions_help_description"
    ],
    "music":[
        "command_mussic_play_01",
        "command_mussic_play_02",
        "command_mussic_stop_01",
        "command_mussic_skip_01",
        "command_mussic_queue_01",
        "command_mussic_queue_02"
    ]

    // Agrega más namespaces según necesites
};

export async function validateAllTranslations(): Promise<void> {
    info("🔍 Validando las traducciones de los comandos...");
    
    let totalErrors = 0;
    const missingTranslations: string[] = [];

    for (const language of SUPPORTED_LANGUAGES) {
        info(`🌐 Validando idioma: ${language.toUpperCase()}`);
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
    } else {1
        info("✅ RESUMEN: Todas las traducciones son válidas\n");
    }
}