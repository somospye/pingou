import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/database";
import { adPosts } from "@/database/schemas/adPosts";

export class AdPostRepository {
	async create(data: {
		userId: string;
		channelId: string;
		contentHash: string;
		normalizedContent: string;
	}) {
		return await db.insert(adPosts).values(data);
	}

	async findRecentByUserAndChannel(
		userId: string,
		channelId: string,
		since: Date,
	) {
		return await db
			.select()
			.from(adPosts)
			.where(
				and(
					eq(adPosts.userId, userId),
					eq(adPosts.channelId, channelId),
					gte(adPosts.createdAt, since),
				),
			);
	}

	async deleteOlderThan(date: Date) {
		return await db.delete(adPosts).where(lt(adPosts.createdAt, date));
	}
}

export const adPostRepository = new AdPostRepository();
