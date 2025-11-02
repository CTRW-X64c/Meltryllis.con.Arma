// src/client/coreCommands/welcomeEvents.ts
import { Client, GuildMember, AttachmentBuilder, TextChannel, EmbedBuilder, PartialGuildMember } from "discord.js";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { debug, error } from "../../sys/logging";
import { getWelcomeConfig } from "../../sys/database";
import path from 'path';

let background: any;

export async function preloadImagesAndFonts(): Promise<void> {
    debug('Preload started.', "WelcomeEvents");
    try {
        const imageUrl = process.env.WELCOME_BANNER_URL || 'https://no-banner.banner/banner.banner';
        debug(`Attempting to load image from URL: ${imageUrl}`, "WelcomeEvents");
        background = await loadImage(imageUrl);
        debug(`Image preloaded successfully from: ${imageUrl}`, "WelcomeEvents");

        const fontPath = path.resolve(__dirname, '../../../adds/fonts/StoryScript-Regular.ttf');
        GlobalFonts.registerFromPath(fontPath, 'StoryScript');
        debug(`Custom font 'StoryScript' registered from: ${fontPath}`, "WelcomeEvents");

    } catch (err) {
        error(`Failed to preload assets: ${err}`, "WelcomeEvents");
    }
}
// Mensaje de bienvenida
export function registerWelcomeEvents(client: Client) {
    debug('Event listeners for welcome and goodbye are being registered.', "WelcomeEvents");

    client.on('guildMemberAdd', async (member: GuildMember | PartialGuildMember) => {
        debug(`Event 'guildMemberAdd' triggered for member: ${member.user.username}`, "WelcomeEvents");
        if (member.partial) {
            try { member = await member.fetch(); } catch (err) { return error(`Error fetching partial member in guildMemberAdd: ${err}`, "WelcomeEvents"); }
        }

        const config = await getWelcomeConfig(member.guild.id);
        if (!config.enabled || !config.channelId) { return debug('Welcome message is disabled or channel not set. Exiting.', "WelcomeEvents"); }

        const welcomeChannel = member.guild.channels.cache.get(config.channelId) as TextChannel;
        if (!welcomeChannel) { return debug(`Welcome channel with ID ${config.channelId} not found. Exiting.`, "WelcomeEvents"); }
        
        try {
            const canvas = createCanvas(600, 200);
            const context = canvas.getContext('2d');
            if (background) context.drawImage(background, 0, 0, canvas.width, canvas.height);
            // Diseño de banner Pic
            const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 128 }));
            context.save();
            context.beginPath();
            context.arc(canvas.width / 2, 60, 50, 0, Math.PI * 2, true);
            context.closePath();
            context.clip();
            context.drawImage(avatar, canvas.width / 2 - 50, 10, 100, 100);
            context.restore();
            context.strokeRect(0, 0, canvas.width, canvas.height);
            // Texto de bienvenida
            context.font = '40px StoryScript';
            context.fillStyle = '#ffffff';
            context.textAlign = 'center';
            context.fillText(`@${member.user.username}`, canvas.width / 2, 145);
            context.fillText(`Se unio al servidor!!`, canvas.width / 2, 185);
          //  context.lineWidth = 3;
         //   context.strokeStyle = '#000000';
        //    context.strokeText(`Se unio al servidor!!`, canvas.width / 2, 185);
    
            const attachment = new AttachmentBuilder(canvas.toBuffer('image/jpeg'), { name: 'welcome-banner.jpg' });
            const welcomeEmbed = new EmbedBuilder().setColor('#00FF00').setImage('attachment://welcome-banner.jpg');
            
            let content = '';
            if (config.customMessage) {
                content = config.customMessage
                    .replace(/<user>/g, `<@${member.user.id}>`)
                    .replace(/{channel}/g, `<#${config.channelId}>`);
            }
            
            await welcomeChannel.send({ content, embeds: [welcomeEmbed], files: [attachment] });
            debug(`Sent welcome banner for user ${member.user.username} in guild ${member.guild.name}`, "WelcomeEvents");
        } catch (err) { error(`Failed to send welcome banner: ${err}`, "WelcomeEvents"); }
    });
// Mensaje de salida
    client.on('guildMemberRemove', async (member: GuildMember | PartialGuildMember) => {
        debug(`Event 'guildMemberRemove' triggered for member: ${member.user?.username || 'unknown'}`, "WelcomeEvents");
        if (member.partial) {
            try { member = await member.fetch(); } catch (err) { return debug(`No se pudo obtener la info completa del miembro parcial: ${member.user?.username || member.user?.id}`, "WelcomeEvents"); }
        }

        const config = await getWelcomeConfig(member.guild.id);
        if (!config.enabled || !config.channelId) { return debug('Goodbye message is disabled or channel not set. Exiting.', "WelcomeEvents"); }

        const welcomeChannel = member.guild.channels.cache.get(config.channelId) as TextChannel;
        if (!welcomeChannel) { return debug(`Welcome channel with ID ${config.channelId} not found. Exiting.`, "WelcomeEvents"); }
        
        const embed = new EmbedBuilder().setColor('#FF0000').setDescription(`**${member.user?.username || 'Un miembro'}** ha dejado el servidor.`);
        await welcomeChannel.send({ embeds: [embed] });
        debug(`Sent goodbye message for user ${member.user?.username || 'un miembro'} in guild ${member.guild.name}`, "WelcomeEvents");
    });
}