// src/client/coreCommands/yTools.ts
import Parser from 'rss-parser';
import i18next from 'i18next';
import { debug, error, info } from '../../sys/logging';
import { getAllYouTubeFeeds, YouTubeFeed, removeYouTubeFeed } from '../../sys/DB-Engine/links/Youtube';

/* =====================================  Youtube  ===================================== */
export function extractChannelIdFromRss(rssUrl: string): string | null {
  const match = rssUrl.match(/channel_id=([^&]+)/);
  return match ? match[1] : null;
}

export function extractVideoId(video: any): string | null {
  if (video.id) {
    return video.id;
  }
  
  if (video.link) {
    const match = video.link.match(/[?&]v=([^&]+)/);
    if (match) return match[1];
  }
  
  if (video.guid) {
    const match = video.guid.match(/video:video\.([^:]+)/);
    if (match) return match[1];
  }
  
  return null;
}

export async function verifyYouTubeRss(rssUrl: string): Promise<{ isValid: boolean; channelName: string; error?: string }> {
    try {
        const parser = new Parser();
        const feed = await parser.parseURL(rssUrl);
        
        if (!feed.title) {
            return { 
                isValid: false, 
                channelName: "Canal de YouTube",
                error: "El feed RSS no contiene un título de canal." 
            };
        }
        
        return { 
            isValid: true, 
            channelName: feed.title 
        };
        
    } catch (error) {
        let rawErrorMessage = error instanceof Error ? error.message : String(error);
        const lowerCaseMessage = rawErrorMessage.toLowerCase();
        let specificError: string;

        if (lowerCaseMessage.includes('404') || lowerCaseMessage.includes('not found')) {
            specificError = i18next.t("error_404", {ns: "youtube"});
        } else if (lowerCaseMessage.includes('403') || lowerCaseMessage.includes('forbidden')) {
            specificError = i18next.t("error_403", {ns: "youtube"});
        } else if (lowerCaseMessage.includes('timeout') || lowerCaseMessage.includes('timed out')) {
            specificError = i18next.t("error_timeout", {ns: "youtube"});
        } else {
            specificError = `Error desconocido: ${rawErrorMessage}`; // Fallback por si es otro error
        }
        
        return { 
            isValid: false, 
            channelName: "Canal de YouTube",
            error: specificError
        };
    }
}
/* =====================================  AutoCLeanYoutube  ===================================== */

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  return 'Error desconocido';
}

class AutoCleanupService {
  private parser: Parser;
  private isCleaning: boolean = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.parser = new Parser();
  }

  start(): void {
    if (this.cleanupInterval) {
      this.stop();
    }

    const MStoDias = 86400000;
    const DEFAULT_Timmer = 5;
    const MIN_TIMMER = 2;
    const rawRssTime = process.env.AUTO_CLEAN_YOUTUBE_TIMMER;
    const parsedDays = rawRssTime ? parseInt(rawRssTime, 10) : NaN;
    const days = !isNaN(parsedDays) ? Math.max(parsedDays, MIN_TIMMER) : DEFAULT_Timmer;
    const cleanUpTimmer = days * MStoDias;  
    const initialDelay = 60 * 60 * 1000;
    
    info(`🔄 Iniciando servicio de limpieza automática (intervalo: ${days} días)`, 'AutoCleanupService');

    setTimeout(() => {
    this.executeCleanup().catch(err => {
      error(`Error en limpieza inicial: ${getErrorMessage(err)}`, 'AutoCleanupService');
      });
  }, initialDelay); 

    this.cleanupInterval = setInterval(() => {
      this.executeCleanup().catch(err => {
        error(`Error en limpieza periódica: ${getErrorMessage(err)}`, 'AutoCleanupService');
      });
  }, cleanUpTimmer);
    
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      info('⏹️ Servicio de limpieza automática detenido', 'AutoCleanupService');
    }
  }

  async executeCleanup(): Promise<{ cleaned: number; errors: string[] }> {
    if (this.isCleaning) {
      debug('Limpieza ya en progreso, omitiendo...', 'AutoCleanupService');
      return { cleaned: 0, errors: ['Limpieza ya en progreso'] };
    }

    this.isCleaning = true;
    const results = {
      cleaned: 0,
      errors: [] as string[]
    };

    try {
      info('🔍 Iniciando limpieza automática de feeds de YouTube...', 'AutoCleanupService');

      const allFeeds = await getAllYouTubeFeeds();
      
      if (allFeeds.length === 0) {
        info('No hay feeds para limpiar', 'AutoCleanupService');
        return results;
      }

      info(`Escaneando ${allFeeds.length} feeds...`, 'AutoCleanupService');

      for (const feed of allFeeds) {
        try {
          const isValid = await this.verifyFeedValidity(feed);
          
          if (!isValid) {
            await removeYouTubeFeed(feed.guild_id, feed.youtube_channel_id);
            results.cleaned++;
            info(`🧹 Eliminado: ${feed.youtube_channel_name} (${feed.youtube_channel_id})`, 'AutoCleanupService');
          }

          await new Promise(resolve => setTimeout(resolve, 2500));
          
        } catch (feedError) {
          const errorMsg = `Error con feed ${feed.youtube_channel_name}: ${getErrorMessage(feedError)}`;
          results.errors.push(errorMsg);
          error(errorMsg, 'AutoCleanupService');
        }
      }

      if (results.cleaned > 0) {
        info(`✅ Limpieza completada: ${results.cleaned} feeds eliminados`, 'AutoCleanupService');
      } else {
        info('Limpieza: No se encontraron feeds inválidos', 'AutoCleanupService');
      }

      if (results.errors.length > 0) {
        error(`⚠️ Errores durante limpieza: ${results.errors.length}`, 'AutoCleanupService');
      }

      return results;

    } catch (err) {
      const errorMsg = `Error crítico en limpieza automática: ${getErrorMessage(err)}`;
      results.errors.push(errorMsg);
      error(errorMsg, 'AutoCleanupService');
      return results;
    } finally {
      this.isCleaning = false;
    }
  }

  private async verifyFeedValidity(feed: YouTubeFeed): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      
      try {
        const rssFeed = await this.parser.parseURL(feed.rss_url);
        clearTimeout(timeout);
        
        const hasValidContent = !!(rssFeed.title && rssFeed.items && rssFeed.items.length > 0);
        
        if (!hasValidContent) {
          debug(`Feed sin contenido: ${feed.youtube_channel_name}`, 'AutoCleanupService');
        }
        
        return hasValidContent;
        
      } catch (parseError) {
        clearTimeout(timeout);
        const errorMsg = getErrorMessage(parseError).toLowerCase();
        
        const isInvalid = errorMsg.includes('404') || errorMsg.includes('not found');
        
        if (isInvalid) {
          debug(`Feed inválido detectado: ${feed.youtube_channel_name} - ${errorMsg}`, 'AutoCleanupService');
        }
        
        return !isInvalid;
      }
      
    } catch (err) {
      debug(`Error en verificación de ${feed.youtube_channel_name}: ${getErrorMessage(err)}`, 'AutoCleanupService');
      return false;
    }
  }

  getStatus(): { isRunning: boolean; isCleaning: boolean } {
    return {
      isRunning: this.cleanupInterval !== null,
      isCleaning: this.isCleaning
    };
  }
}

export const autoCleanupService = new AutoCleanupService();
