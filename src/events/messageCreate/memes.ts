import type { Message, UsingClient } from "seyfert";
import { CONFIG } from "@/config";

const URL_REGEX = /https?:\/\/[^\s]+/i;

function hasAttachmentOrLink(message: Message): boolean {
	if (message.attachments?.length) return true;
	if (URL_REGEX.test(message.content ?? "")) return true;
	return false;
}

export async function handleMemes(
	message: Message,
	client: UsingClient,
): Promise<void> {
	if (!CONFIG.CHANNELS.MEMES || message.channelId !== CONFIG.CHANNELS.MEMES) {
		return;
	}

	if (!hasAttachmentOrLink(message)) {
		await message
			.delete("Mensaje sin multimedia en canal de memes")
			.catch(() => {});

		const displayName = message.member?.displayName ?? message.author.username;

		await client.messages
			.write(CONFIG.CHANNELS.CHAT_GENERAL, {
				content: `<@${message.author.id}> **${displayName}**, en <#${CONFIG.CHANNELS.MEMES}> solo se permiten memes con imagen, video o link.`,
			})
			.catch(() => {});
		return;
	}

	if (!CONFIG.MEMES_REACTIONS.length) return;

	await Promise.all(
		CONFIG.MEMES_REACTIONS.map((emoji) =>
			client.reactions
				.add(message.id, message.channelId, emoji)
				.catch(() => {}),
		),
	);
}
