import { createEvent } from "seyfert";
import { memeReactionsRepository } from "@/repositories/memeReactionsRepository";

export default createEvent({
	data: { once: false, name: "messageCreate" },
	async run(message, client) {
		if (message.author.bot) return;

		const guildId = message.guildId;
		if (!guildId) return;

		const reactions = await memeReactionsRepository.findByChannel(
			guildId,
			message.channelId,
		);
		if (reactions.length === 0) return;

		for (const row of reactions) {
			await client.reactions
				.add(message.id, message.channelId, row.emoji)
				.catch(() => {});
		}
	},
});
