// src/client/coreCommands/yTools.ts
import Parser from 'rss-parser';
import i18next from 'i18next';

const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }
});

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
