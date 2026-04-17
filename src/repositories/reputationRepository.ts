import { eq, sql } from "drizzle-orm";
import { db } from "../database";
import { reputation } from "../database/schemas/reputation";

export class ReputationRepository {
	async addReputation(userId: string, points = 1) {
		const results = await db
			.insert(reputation)
			.values({ userId, points })
			.onConflictDoUpdate({
				target: reputation.userId,
				set: { points: sql`${reputation.points} + ${points}` },
			})
			.returning();

		return results[0]?.points ?? points;
	}

	async findByUserId(userId: string) {
		const results = await db
			.select()
			.from(reputation)
			.where(eq(reputation.userId, userId))
			.limit(1);
		return results[0];
	}

	async getReputation(userId: string) {
		const result = await this.findByUserId(userId);
		return result?.points ?? 0;
	}

	async update(userId: string, points: number) {
		return await db
			.update(reputation)
			.set({ points })
			.where(eq(reputation.userId, userId));
	}
}

export const reputationRepository = new ReputationRepository();
