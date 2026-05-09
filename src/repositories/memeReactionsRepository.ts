import { and, eq } from "drizzle-orm";
import { db } from "@/database";
import { memeReactions } from "@/database/schemas/memeReactions";

export class MemeReactionsRepository {
	private cache = new Map<string, string[]>();

	private cacheKey(guildId: string, channelId: string) {
		return `${guildId}:${channelId}`;
	}

	private invalidate(guildId: string, channelId: string) {
		this.cache.delete(this.cacheKey(guildId, channelId));
	}

	async getEmojisForChannel(
		guildId: string,
		channelId: string,
	): Promise<string[]> {
		const key = this.cacheKey(guildId, channelId);
		const cached = this.cache.get(key);
		if (cached !== undefined) return cached;

		const rows = await this.findByChannel(guildId, channelId);
		const emojis = rows.map((r) => r.emoji);
		this.cache.set(key, emojis);
		return emojis;
	}

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
		const result = await db
			.insert(memeReactions)
			.values({ guildId, channelId, emoji })
			.onConflictDoNothing()
			.returning({ id: memeReactions.id });
		this.invalidate(guildId, channelId);
		return result;
	}

	async remove(guildId: string, channelId: string, emoji: string) {
		const result = await db
			.delete(memeReactions)
			.where(
				and(
					eq(memeReactions.guildId, guildId),
					eq(memeReactions.channelId, channelId),
					eq(memeReactions.emoji, emoji),
				),
			)
			.returning({ id: memeReactions.id });
		this.invalidate(guildId, channelId);
		return result;
	}
}

export const memeReactionsRepository = new MemeReactionsRepository();
