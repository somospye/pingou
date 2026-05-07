import {
	ActionRow,
	Button,
	Container,
	MediaGallery,
	MediaGalleryItem,
	type Message,
	TextDisplay,
	type UsingClient,
} from "seyfert";
import type {
	MessageCreateBodyRequest,
	ObjectToLower,
} from "seyfert/lib/common";
import {
	ButtonStyle,
	type GatewayMessageReactionAddDispatchData,
	MessageFlags,
} from "seyfert/lib/types";
import { CONFIG } from "@/config";

const STAR_THRESHOLD = 3;

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
		msg = await client.messages.fetch(
			reaction.messageId,
			reaction.channelId,
			true,
		);
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
				client.logger.warn(
					"[starboard] could not delete demoted starboard entry:",
					err,
				);
			} finally {
				messageStore.delete(reaction.messageId);
			}
		}
		return;
	}

	const content = buildStarboardContent(count, msg);

	const existingStarboardId = messageStore.get(reaction.messageId);
	if (existingStarboardId) {
		try {
			await client.messages.edit(
				existingStarboardId,
				CONFIG.CHANNELS.STARBOARD,
				content,
			);
		} catch (err) {
			client.logger.error("[starboard] failed to edit starboard message:", err);
		}
		return;
	}

	try {
		const posted = await client.messages.write(
			CONFIG.CHANNELS.STARBOARD,
			content,
		);
		messageStore.set(reaction.messageId, posted.id);
	} catch (err) {
		client.logger.error("[starboard] failed to post to starboard:", err);
	}
}

function buildStarboardContent(
	count: number,
	originalMsg: Message,
): MessageCreateBodyRequest {
	const container = new Container()
		.addComponents(
			new TextDisplay().setContent(
				`-# Mensaje de ${originalMsg.author.toString()} en <#${originalMsg.channelId}>`,
			),
		)
		.setColor("Blue");

	if (originalMsg.content.length > 0) {
		container.addComponents(new TextDisplay().setContent(originalMsg.content));
	}

	if (originalMsg.attachments.length > 0) {
		const gallery = new MediaGallery();
		originalMsg.attachments.map((att) =>
			gallery.addItems(new MediaGalleryItem().setMedia(att.proxyUrl)),
		);
		container.addComponents(gallery);
	}

	const buttons = new ActionRow().addComponents(
		new Button()
			.setStyle(ButtonStyle.Secondary)
			.setCustomId("starboard")
			.setDisabled(true)
			.setEmoji(CONFIG.EMOJIS.STAR)
			.setLabel(count.toString()),
		new Button()
			.setStyle(ButtonStyle.Link)
			.setURL(
				`https://discord.com/channels/${originalMsg.guildId}/${originalMsg.channelId}/${originalMsg.id}`,
			)
			.setLabel("Ir al mensaje"),
	);

	return {
		components: [container, buttons],
		flags: MessageFlags.IsComponentsV2,
	};
}
