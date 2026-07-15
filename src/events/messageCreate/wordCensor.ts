import type { Message, UsingClient } from "seyfert";
import { CONFIG } from "@/config";
import { censorService } from "@/services/censorService";

export async function handleWordCensor(
	message: Message,
	client: UsingClient,
): Promise<boolean> {
	if (!CONFIG.CENSOR_ENABLED) return false;
	if (!censorService.words.length) return false;

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
		await client.messages
			.write(message.channelId, { content: `**${displayName}:** ${censored}` })
			.catch((fallbackErr) =>
				console.error("Failed to send censored fallback message:", fallbackErr),
			);
	});

	return true;
}
