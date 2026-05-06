import type { UsingClient } from "seyfert";
import type { GatewayMessageReactionAddDispatchData } from "seyfert/lib/types";
import type { ObjectToLower } from "seyfert/lib/common";
import { CONFIG } from "@/config";

const STAR_THRESHOLD = 1;

const messageStore = new Map<string, string>();

// todo: make starboard allow multiple emojis ~elisiei
// note: this current starboard system does not edit the message if
// the star count decreases.
export async function handleStarboard(
    reaction: ObjectToLower<GatewayMessageReactionAddDispatchData>,
    client: UsingClient,
): Promise<void> {
    if (reaction.emoji.name !== CONFIG.EMOJIS.STAR) return;

    if (!CONFIG.CHANNELS.STARBOARD) {
        client.logger.warn("[starboard] STARBOARD_CHANNEL_ID is not set");
        return;
    }

    if (reaction.channelId === CONFIG.CHANNELS.STARBOARD) return;

    let msg: Awaited<ReturnType<typeof client.messages.fetch>>;

    try {
        msg = await client.messages.fetch(reaction.messageId, reaction.channelId, true);
    } catch (err) {
        client.logger.error("[starboard] failed to fetch original message:", err);
        return;
    }

    const starReaction = msg.reactions?.find(
        (r) => (r.emoji.name ?? r.emoji.id) === CONFIG.EMOJIS.STAR,
    );
    const count = starReaction?.count ?? 0;

    if (count < STAR_THRESHOLD) {
        const existingId = messageStore.get(reaction.messageId);
        if (existingId) {
            try {
                await client.messages.delete(existingId, CONFIG.CHANNELS.STARBOARD);
            } catch (err) {
                client.logger.warn("[starboard] could not delete demoted starboard entry:", err);
            } finally {
                messageStore.delete(reaction.messageId);
            }
        }
        return;
    }

    const content = buildStarboardContent(count, {
        content: msg.content,
        channelId: reaction.channelId,
        id: reaction.messageId,
        guildId: reaction.guildId,
    });

    const existingStarboardId = messageStore.get(reaction.messageId);
    if (existingStarboardId) {
        try {
            await client.messages.edit(existingStarboardId, CONFIG.CHANNELS.STARBOARD, { content });
        } catch (err) {
            client.logger.error("[starboard] failed to edit starboard message:", err);
        }
        return;
    }

    try {
        const posted = await client.messages.write(CONFIG.CHANNELS.STARBOARD, { content });
        messageStore.set(reaction.messageId, posted.id);
    } catch (err) {
        client.logger.error("[starboard] failed to post to starboard:", err);
    }
}

function buildStarboardContent(
    count: number,
    originalMsg: {
        content?: string;
        channelId: string;
        id: string;
        guildId?: string;
    },
): string {
    const jump = originalMsg.guildId
        ? `\nhttps://discord.com/channels/${originalMsg.guildId}/${originalMsg.channelId}/${originalMsg.id}`
        : "";
    return `:star: **${count}** | <#${originalMsg.channelId}>${jump}\n\n${originalMsg.content ?? "*(sin contenido)*"}`;
}
