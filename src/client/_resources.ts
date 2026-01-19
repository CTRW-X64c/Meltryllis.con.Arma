// src/commands/resources.ts

/* =================== Interfaces =================== */

export interface ChannelConfig {
  enabled: boolean;
  replyBots: boolean;
}

/* =================== UTILIDADES DE EMBEDS =================== */

export function randomcolorembed(): string {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}


