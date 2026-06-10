import type { Message, UsingClient } from "seyfert";
import { CONFIG } from "@/config";
import { censorService } from "@/services/censorService";

/**
 * Censura palabras blacklisteadas (CONFIG.CENSOR.WORDS): borra el mensaje
 * original y lo repostea con las palabras reemplazadas por asteriscos vía
 * un webhook que imita el nombre y avatar del autor (estilo NQN). Devuelve
 * true si el mensaje fue censurado, para que index.ts corte la cadena.
 */
export async function handleWordCensor(
	message: Message,
	client: UsingClient,
): Promise<boolean> {
	if (!CONFIG.CENSOR.WORDS.length) return false;

	const censored = censorService.censor(message.content ?? "");
	if (!censored) return false;

	const displayName = message.member?.displayName ?? message.author.username;

	await message
		.delete("Blacklisted word censored")
		.catch((err) =>
			console.error("Failed to delete blacklisted message:", err),
		);

	await censorService.repostAsUser(message, censored).catch(async (err) => {
		console.error("Failed to repost censored message via webhook:", err);
		// Fallback: que el contenido censurado no se pierda
		await client.messages
			.write(message.channelId, { content: `**${displayName}:** ${censored}` })
			.catch((fallbackErr) =>
				console.error("Failed to send censored fallback message:", fallbackErr),
			);
	});

	return true;
}
