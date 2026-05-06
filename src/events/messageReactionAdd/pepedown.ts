import type { UsingClient } from "seyfert";
import type { GatewayMessageReactionAddDispatchData } from "seyfert/lib/types";
import type { ObjectToLower } from "seyfert/lib/common";
import { CONFIG } from "@/config";

const PEPEDOWN_TIME_BASE = 1000 * 60 * 60;

export async function handlePepedown(
    reaction: ObjectToLower<GatewayMessageReactionAddDispatchData>,
    client: UsingClient,
): Promise<void> {
    const { guildId, messageAuthorId: memberId } = reaction;

    if (!(guildId && memberId)) return;
    if (reaction.emoji.id !== CONFIG.EMOJIS.PEPEDOWN) return;

    const message = await client.messages.fetch(reaction.messageId, reaction.channelId);
    const reactionObject = message.reactions?.find(
        (r) => r.emoji.id === reaction.emoji.id && r.emoji.name === reaction.emoji.name,
    );

    const member = await client.members.fetch(guildId, memberId);

    try {
        if (member.roles.keys.includes(CONFIG.ROLES.PEPEDOWN)) return;

        if (reactionObject?.count === 5) {
            await client.members.addRole(guildId, memberId, CONFIG.ROLES.PEPEDOWN);
            await client.messages.write(reaction.channelId, {
                content: `<@${memberId}> ahora tiene IQ negativo`,
            });
        }

        setTimeout(() => {
            client.members.removeRole(guildId, memberId, CONFIG.ROLES.PEPEDOWN);
        }, PEPEDOWN_TIME_BASE);
        // create a queue with bullmq to handle this lol. ~elisiei
    } catch (e) {
        console.error(e);
    }
}
