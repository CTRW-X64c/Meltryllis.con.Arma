// src/sys/managerPermission.ts
import { ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { getCommandPermissions } from "../../sys/DB-Engine/links/Permission";


export async function hasPermission( interaction: ChatInputCommandInteraction, commandName: string ): Promise<boolean> {
    const { guild, user, member, memberPermissions } = interaction;
    if (!guild || !member) return false;
    if (user.id === guild.ownerId || memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return true;
    }
    
    const allowedIds = await getCommandPermissions(guild.id, commandName);
    if (allowedIds.size === 0) return false;
    if (allowedIds.has(user.id)) return true;

    const roles = Array.isArray(member.roles) ? member.roles : member.roles.cache;    
    return roles.some((role: any) => allowedIds.has(role.id));
}