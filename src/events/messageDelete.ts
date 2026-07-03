import { createEvent } from "seyfert";
import { CONFIG } from "@/config";
import { deletedForumPostService } from "@/services/deletedForumPostService";
import { Embeds } from "@/utils/embeds";

export default createEvent({
	data: { once: false, name: "messageDelete" },
	async run(message, client) {
		// In forum posts the starter message shares its id with the thread
		if (message.id !== message.channelId) return;

		const channel = await client.channels
			.fetch(message.channelId)
			.catch(() => null);
		if (!channel?.isThread()) return;

		const forum = await client.channels
			.fetch(channel.parentId)
			.catch(() => null);
		if (!forum?.isForum()) return;

		await client.channels
			.delete(channel.id, {
				reason: "Forum post starter message was deleted",
			})
			.catch((err) => console.error("Failed to delete forum thread:", err));

		await deletedForumPostService.record({
			threadId: channel.id,
			forumId: forum.id,
			authorId: channel.ownerId ?? null,
			title: channel.name,
		});

		await client.messages
			.write(CONFIG.CHANNELS.MOD_LOG, {
				embeds: [
					Embeds.forumPostDeletedEmbed({
						title: channel.name,
						forumName: forum.name,
						authorId: channel.ownerId ?? null,
					}),
				],
			})
			.catch((err) =>
				console.error("Failed to send forum post deletion log:", err),
			);
	},
});
