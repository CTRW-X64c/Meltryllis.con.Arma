// src/client/coreCommands/welcomeEvents.ts
import { Client, GuildMember, AttachmentBuilder, TextChannel, EmbedBuilder, PartialGuildMember } from "discord.js";
import { createCanvas, loadImage, GlobalFonts, Image } from "@napi-rs/canvas";
import { debug, error } from "../sys/logging";
import { getNewConfiWelcome } from "../sys/DB-Engine/links/Welcome";
import path from 'path';
import fs from 'fs';

export let chaBg: { [key: string]: Image } = {};
export let fonts: { name: string, value: string }[] = [];

async function preloadImagesAndFonts(): Promise<void> {
    debug('Preload started.', "WelcomeEvents");
    try {
        //pics
        const kch = await loadImage(process.env.WELCOME_BANNER_URL || "https://i.imgur.com/334eyBb.jpeg");
        chaBg["default"] = kch;
        //fonts
        const fontsPath = path.resolve(__dirname, "../../adds/fonts/");
        if (!fs.existsSync(fontsPath)) { error(`Fonts directory not found: ${fontsPath}`, "WelcomeEvents"); return }
        const files = fs.readdirSync(fontsPath);
        const fontFiles = files.filter(file => file.endsWith('.ttf'));
        const fontStatuses: { [key: string]: boolean } = {};
        for (const file of fontFiles) {
            const filePath = path.join(fontsPath, file);
            const fontName = path.parse(file).name;
            const status = GlobalFonts.registerFromPath(filePath, fontName);
            fontStatuses[fontName] = !!status;
            fonts.push({ name: fontName, value: fontName });
            debug(`Font: ${fontName} - ${status ? '✓' : '✗'}`, "WelcomeEvents");
        }

        const loadedCount = Object.values(fontStatuses).filter(Boolean).length;
        debug(`Loaded ${loadedCount}/${fontFiles.length} fonts`, "WelcomeEvents");
    } catch (err) {
        error(`Failed to preload assets: ${err}`, "WelcomeEvents");
    }
}

export async function buildBanner(member: GuildMember): Promise<{ embeds: EmbedBuilder[]; files: AttachmentBuilder[] } | null> {
    try {
        const config = await getNewConfiWelcome(member.guild.id);
        if (!config) return null;
        if (config && config.background !== "default") {
            if (!chaBg[member.guild.id]) {
                chaBg[member.guild.id] = await loadImage(config.background);
            }
        }
        const canvas = createCanvas(1200, 500);
        const context = canvas.getContext('2d');
        const background = chaBg[member.guild.id] || chaBg["default"];
        if (background) context.drawImage(background, 0, 0, canvas.width, canvas.height);

        const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));

        const avatarSize = canvas.height * 0.5;
        const avatarRadius = avatarSize / 2;
        const avatarX = (canvas.width / 2) - avatarRadius;
        const avatarY = 30;

        context.save();
        context.beginPath();
        // Círculo para recortar el avatar
        context.arc(canvas.width / 2, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2, true);
        context.closePath();
        context.clip();
        context.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        context.restore();
        // Borde del avatar
        const ringThickness = avatarSize / 18;  //tamaño del avatar
        context.save();
        context.beginPath();
        context.arc(canvas.width / 2, avatarY + avatarRadius, avatarRadius + (ringThickness / 2), 0, Math.PI * 2, true);
        context.lineWidth = ringThickness;
        context.strokeStyle = `#${config.ringcolor.padStart(6, '0')}`;  // Color anillo '#a3a3a3';
        context.stroke();
        context.restore();

        context.strokeRect(0, 0, canvas.width, canvas.height);

        context.textAlign = 'center';
        //Sombras
        context.shadowColor = 'rgba(0, 0, 0, 0.9)';     // opacidad
        context.shadowBlur = 10;                           // difuminada está la sombra
        context.shadowOffsetX = 3;                        // Desplazamiento hacia la derecha
        context.shadowOffsetY = 3;                        // Desplazamiento hacia abajo                
        // 1ra línea
        context.font = `${config.fText.size}px "${config.fText.font}"`;
        context.fillStyle = `#${config.fText.color.padStart(6, '0')}`;
        context.fillText(config.fText.text.replace(/<user>/g, member.user.username), canvas.width / 2, avatarY + avatarSize + 90);
        // 2da línea
        if (config.sText) {
            context.font = `${config.sText.size}px "${config.sText.font}"`;
            context.fillStyle = `#${config.sText.color.padStart(6, '0')}`;
            context.fillText(config.sText.text.replace(/<user>/g, member.user.username), canvas.width / 2, avatarY + avatarSize + 150);
        }
        // 3ra línea
        if (config.tText) {
            context.font = `${config.tText.size}px "${config.tText.font}"`;
            context.fillStyle = `#${config.tText.color.padStart(6, '0')}`;
            context.fillText(config.tText.text.replace(/<user>/g, member.user.username), canvas.width / 2, avatarY + avatarSize + 200);
        }
        // fix sombras
        context.shadowColor = 'transparent';
        context.shadowBlur = 0;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;

        const attachment = new AttachmentBuilder(canvas.toBuffer('image/jpeg'), { name: 'welcome-banner.jpg' });
        const welcomeEmbed = new EmbedBuilder().setColor(0x00FF00).setImage('attachment://welcome-banner.jpg').setTimestamp();

        if (config.customMessage != "") {
            let content = '';
            if (config.customMessage) {
                content = config.customMessage
                    .replace(/<user>/g, `<@${member.user.id}>`)
                    .replace(/<channel>/g, `<#${config.channelId}>`);
            }
            welcomeEmbed.setDescription(content);
        }

        return { embeds: [welcomeEmbed], files: [attachment] };
    } catch {
        return null;
    }
}

// Mensaje de bienvenida
function registerWelcomeEvents(client: Client) {
    debug('Event listeners for welcome and goodbye are being registered.', "WelcomeEvents");

    client.on('guildMemberAdd', async (member: GuildMember | PartialGuildMember) => {
        debug(`Event 'guildMemberAdd' triggered for member: ${member.user.username}`, "WelcomeEvents");
        if (member.partial) {
            try { member = await member.fetch(); } catch (err) { return error(`Error fetching partial member in guildMemberAdd: ${err}`, "WelcomeEvents"); }
        }

        const config = await getNewConfiWelcome(member.guild.id);
        if (!config || !config.channelId) { return debug('Welcome message is disabled or channel not set. Exiting.', "WelcomeEvents"); }

        let welcomeChannel = member.guild.channels.cache.get(config.channelId) as TextChannel;
        if (!welcomeChannel) {
            try {
                welcomeChannel = await member.guild.channels.fetch(config.channelId) as TextChannel;
            } catch (err) {
                return debug(`Welcome channel with ID ${config.channelId} not found or no permissions. Exiting.`, "WelcomeEvents");
            }
        }

        try {
            const bannerData = await buildBanner(member);
            if (!bannerData) return;

            await welcomeChannel.send({ embeds: bannerData.embeds, files: bannerData.files });

            debug(`Sent welcome banner for user ${member.user.username} in guild ${member.guild.name}`, "WelcomeEvents");
        } catch (err) { error(`Failed to send welcome banner: ${err}`, "WelcomeEvents"); }
    });

    // Mensaje de salida
    client.on('guildMemberRemove', async (member: GuildMember | PartialGuildMember) => {
        debug(`Event 'guildMemberRemove' triggered for member: ${member.user?.username || 'unknown'}`, "WelcomeEvents");
        if (member.partial) {
            try { member = await member.fetch(); } catch (err) { return debug(`No se pudo obtener la info completa del miembro parcial: ${member.user?.username || member.user?.id}`, "WelcomeEvents"); }
        }

        const config = await getNewConfiWelcome(member.guild.id);
        if (!config || !config.channelId || !config.exitmesseng) { return debug('Goodbye message is disabled or channel not set. Exiting.', "WelcomeEvents"); }

        let welcomeChannel = member.guild.channels.cache.get(config.channelId) as TextChannel;
        if (!welcomeChannel) {
            try {
                welcomeChannel = await member.guild.channels.fetch(config.channelId) as TextChannel;
            } catch (err) {
                return debug(`Welcome channel with ID ${config.channelId} not found or no permissions. Exiting.`, "WelcomeEvents");
            }
        }

        const embed = new EmbedBuilder().setColor('#FF0000').setDescription(`**${member.user?.username || 'Un miembro'}** ha dejado el servidor.`);
        await welcomeChannel.send({ embeds: [embed] });
        debug(`Sent goodbye message for user ${member.user?.username || 'un miembro'} in guild ${member.guild.name}`, "WelcomeEvents");
    });
}

// Inicializador de Welcome 

export async function startWelcomeEvents(client: Client): Promise<void> {
    await preloadImagesAndFonts();
    registerWelcomeEvents(client);
}
