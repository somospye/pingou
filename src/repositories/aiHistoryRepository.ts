import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/database";
import { aiHistory } from "@/database/schemas/aiHistory";

export class AiHistoryRepository {
	async add(
		entries: { userId: string; role: "user" | "assistant"; content: string }[],
	) {
		if (!entries.length) return;
		return await db.insert(aiHistory).values(entries);
	}

	/** Últimos `limit` mensajes desde `since`, del más viejo al más nuevo. */
	async findRecent(userId: string, since: Date, limit: number) {
		const rows = await db
			.select()
			.from(aiHistory)
			.where(and(eq(aiHistory.userId, userId), gte(aiHistory.createdAt, since)))
			.orderBy(desc(aiHistory.createdAt), desc(aiHistory.id))
			.limit(limit);
		return rows.reverse();
	}

	async deleteByUser(userId: string) {
		return await db
			.delete(aiHistory)
			.where(eq(aiHistory.userId, userId))
			.returning({ id: aiHistory.id });
	}

	async deleteOlderThan(date: Date) {
		return await db.delete(aiHistory).where(lt(aiHistory.createdAt, date));
	}
}

export const aiHistoryRepository = new AiHistoryRepository();
