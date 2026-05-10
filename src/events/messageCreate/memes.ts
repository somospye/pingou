import type { Message, UsingClient } from "seyfert";
import { CONFIG } from "@/config";

/**
 * Si el mensaje cae en CONFIG.CHANNELS.MEMES, agrega las reacciones
 * configuradas en CONFIG.MEMES_REACTIONS. Aditivo — no corta la cadena
 * de handlers de messageCreate.
 */
export async function handleMemes(
	message: Message,
	client: UsingClient,
): Promise<void> {
	if (
		!CONFIG.CHANNELS.MEMES ||
		message.channelId !== CONFIG.CHANNELS.MEMES ||
		!CONFIG.MEMES_REACTIONS.length
	) {
		return;
	}

	await Promise.all(
		CONFIG.MEMES_REACTIONS.map((emoji) =>
			client.reactions
				.add(message.id, message.channelId, emoji)
				.catch(() => {}),
		),
	);
}
