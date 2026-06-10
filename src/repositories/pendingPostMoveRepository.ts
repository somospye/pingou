import { and, arrayContains, eq, lt, not, sql } from "drizzle-orm";
import { db } from "@/database";
import { pendingPostMoves } from "@/database/schemas/pendingPostMoves";

interface Data {
	threadId: string;
	targetForumId: string;
	reason: string;
	initiatorId: string;
}

export class PendingPostMoveRepository {
	async create(data: Data) {
		return await db.insert(pendingPostMoves).values({ ...data, voterIds: [] });
	}

	async findByThreadId(threadId: string) {
		const results = await db
			.select()
			.from(pendingPostMoves)
			.where(eq(pendingPostMoves.threadId, threadId))
			.limit(1);
		return results[0];
	}

	async addVoter(threadId: string, voterId: string) {
		const results = await db
			.update(pendingPostMoves)
			.set({
				voterIds: sql`array_append(${pendingPostMoves.voterIds}, ${voterId})`,
			})
			.where(
				and(
					eq(pendingPostMoves.threadId, threadId),
					not(arrayContains(pendingPostMoves.voterIds, [voterId])),
				),
			)
			.returning();
		return results[0];
	}

	async deleteByThreadId(threadId: string) {
		return await db
			.delete(pendingPostMoves)
			.where(eq(pendingPostMoves.threadId, threadId))
			.returning();
	}

	async deleteOlderThan(date: Date) {
		return await db
			.delete(pendingPostMoves)
			.where(lt(pendingPostMoves.createdAt, date));
	}
}

export const pendingPostMoveRepository = new PendingPostMoveRepository();
