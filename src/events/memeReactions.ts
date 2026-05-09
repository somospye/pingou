import { createEvent } from "seyfert";
import { CONFIG } from "@/config";

export default createEvent({
	data: { once: false, name: "messageCreate" },
	async run(message, client) {
		if (message.author.bot) return;
		if (
			!CONFIG.CHANNELS.MEMES ||
			message.channelId !== CONFIG.CHANNELS.MEMES ||
			!CONFIG.MEMES_REACTIONS.length
		)
			return;

		await Promise.all(
			CONFIG.MEMES_REACTIONS.map((emoji) =>
				client.reactions
					.add(message.id, message.channelId, emoji)
					.catch(() => {}),
			),
		);
	},
});
