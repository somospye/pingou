import { and, eq } from "drizzle-orm";
import { db } from "@/database";
import { memeReactions } from "@/database/schemas/memeReactions";

export class MemeReactionsRepository {
	async findByChannel(guildId: string, channelId: string) {
		return db
			.select()
			.from(memeReactions)
			.where(
				and(
					eq(memeReactions.guildId, guildId),
					eq(memeReactions.channelId, channelId),
				),
			);
	}

	async findByGuild(guildId: string) {
		return db
			.select()
			.from(memeReactions)
			.where(eq(memeReactions.guildId, guildId));
	}

	async add(guildId: string, channelId: string, emoji: string) {
		return db
			.insert(memeReactions)
			.values({ guildId, channelId, emoji })
			.onConflictDoNothing();
	}

	async remove(guildId: string, channelId: string, emoji: string) {
		return db
			.delete(memeReactions)
			.where(
				and(
					eq(memeReactions.guildId, guildId),
					eq(memeReactions.channelId, channelId),
					eq(memeReactions.emoji, emoji),
				),
			);
	}

	async removeAllFromChannel(guildId: string, channelId: string) {
		return db
			.delete(memeReactions)
			.where(
				and(
					eq(memeReactions.guildId, guildId),
					eq(memeReactions.channelId, channelId),
				),
			);
	}
}

export const memeReactionsRepository = new MemeReactionsRepository();
