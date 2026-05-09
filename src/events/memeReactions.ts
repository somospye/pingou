import { createEvent } from "seyfert";
import { memeReactionsRepository } from "@/repositories/memeReactionsRepository";

export default createEvent({
	data: { once: false, name: "messageCreate" },
	async run(message, client) {
		if (message.author.bot) return;

		const guildId = message.guildId;
		if (!guildId) return;

		const emojis = await memeReactionsRepository.getEmojisForChannel(
			guildId,
			message.channelId,
		);
		if (emojis.length === 0) return;

		await Promise.all(
			emojis.map((emoji) =>
				client.reactions
					.add(message.id, message.channelId, emoji)
					.catch(() => {}),
			),
		);
	},
});
