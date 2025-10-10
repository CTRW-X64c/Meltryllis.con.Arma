// src/client/events/rolemojiEvents.ts
import { Client, MessageReaction, User, PartialMessageReaction, PartialUser, GuildMember } from "discord.js";
import { debug, error } from "../../logging";
import { getRoleAssignments } from "../database";

export function registerRolemojiEvents(client: Client) {
    debug('Event listeners for role assignment are being registered.', "RolemojiEvents");
// Asignador de Roles
    client.on('messageReactionAdd', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
        debug(`Event 'messageReactionAdd' triggered by user ${user.username} for reaction ${reaction.emoji.name}`, "RolemojiEvents");
        
        if (user.id === client.user!.id) {
            debug('Ignoring reaction: User is the bot itself.', "RolemojiEvents");
            return;
        }

        if (reaction.partial) {
            try {
                reaction = await reaction.fetch();
            } catch (err) {
                return error(`Failed to fetch partial reaction on add: ${err}`, "RolemojiEvents");
            }
        }
        if (user.partial) {
            try {
                user = await user.fetch();
            } catch (err) {
                return error(`Failed to fetch partial user on reaction add: ${err}`, "RolemojiEvents");
            }
        }
        
        if (reaction.message.guildId === null) {
            return;
        }

        const assignments = await getRoleAssignments(reaction.message.guildId);
        const emojiKey = reaction.emoji.id ? reaction.emoji.id : reaction.emoji.name;
        const key = `${reaction.message.id}:${emojiKey}`;
        const assignment = assignments.get(key);

        if (assignment) {
            debug(`Assignment found in DB for emoji ${emojiKey}. Attempting to assign role...`, "RolemojiEvents");
            const member = reaction.message.guild!.members.cache.get(user.id) as GuildMember;
            if (member) {
                try {
                    const role = reaction.message.guild!.roles.cache.get(assignment.roleId);
                    if (role) {
                        await member.roles.add(role);
                        debug(`Assigned role ${role.name} to user ${user.username} via reaction.`, "RolemojiEvents");
                    } else {
                        debug(`Role with ID ${assignment.roleId} not found in guild cache.`, "RolemojiEvents");
                    }
                } catch (err) {
                    error(`Failed to assign role via reaction. Check bot permissions and role hierarchy. Error: ${err}`, "RolemojiEvents");
                }
            } else {
                debug(`Member ${user.username} not found in guild cache.`, "RolemojiEvents");
            }
        } else {
            debug(`No assignment found in DB for emoji ${emojiKey}.`, "RolemojiEvents");
        }
    });

// Removedor de Roles
    client.on('messageReactionRemove', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
        debug(`Event 'messageReactionRemove' triggered by user ${user.username} for reaction ${reaction.emoji.name}`, "RolemojiEvents");

        if (user.id === client.user!.id) {
            debug('Ignoring reaction removal: User is the bot itself.', "RolemojiEvents");
            return;
        }

        if (reaction.partial) {
            try {
                reaction = await reaction.fetch();
            } catch (err) {
                return error(`Failed to fetch partial reaction on remove: ${err}`, "RolemojiEvents");
            }
        }
        if (user.partial) {
            try {
                user = await user.fetch();
            } catch (err) {
                return error(`Failed to fetch partial user on reaction remove: ${err}`, "RolemojiEvents");
            }
        }
        
        if (reaction.message.guildId === null) {
            return;
        }

        const assignments = await getRoleAssignments(reaction.message.guildId);
        const emojiKey = reaction.emoji.id ? reaction.emoji.id : reaction.emoji.name;
        const key = `${reaction.message.id}:${emojiKey}`;
        const assignment = assignments.get(key);

        if (assignment) {
            debug(`Assignment found in DB for emoji ${emojiKey}. Attempting to remove role...`, "RolemojiEvents");
            const member = reaction.message.guild!.members.cache.get(user.id) as GuildMember;
            if (member) {
                try {
                    const role = reaction.message.guild!.roles.cache.get(assignment.roleId);
                    if (role) {
                        await member.roles.remove(role);
                        debug(`Removed role ${role.name} from user ${user.username} via reaction.`, "RolemojiEvents");
                    } else {
                        debug(`Role with ID ${assignment.roleId} not found in guild cache.`, "RolemojiEvents");
                    }
                } catch (err) {
                    error(`Failed to remove role via reaction. Check bot permissions and role hierarchy. Error: ${err}`, "RolemojiEvents");
                }
            } else {
                debug(`Member ${user.username} not found in guild cache.`, "RolemojiEvents");
            }
        } else {
            debug(`No assignment found in DB for emoji ${emojiKey}.`, "RolemojiEvents");
        }
    });
}