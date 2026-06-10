import { and, desc, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/database";
import { economy } from "@/database/schemas/economy";

export class EconomyRepository {
	async findOrCreate(userId: string) {
		const results = await db
			.insert(economy)
			.values({ userId })
			.onConflictDoNothing()
			.returning();
		if (results[0]) return results[0];
		const existing = await db
			.select()
			.from(economy)
			.where(eq(economy.userId, userId))
			.limit(1);
		return (
			existing[0] ?? {
				userId,
				coins: 0,
				lastDaily: null,
				lastWork: null,
				lastRob: null,
			}
		);
	}

	async getBalance(userId: string) {
		const result = await db
			.select()
			.from(economy)
			.where(eq(economy.userId, userId))
			.limit(1);
		return result[0]?.coins ?? 0;
	}

	// The WHERE guard on the timestamp makes the claim atomic: a concurrent
	// claim for the same user only succeeds once per cooldown window.
	async claimDaily(userId: string, amount: number, cutoff: Date) {
		const result = await db
			.update(economy)
			.set({ coins: sql`${economy.coins} + ${amount}`, lastDaily: new Date() })
			.where(
				and(
					eq(economy.userId, userId),
					or(isNull(economy.lastDaily), lt(economy.lastDaily, cutoff)),
				),
			)
			.returning();
		return result[0];
	}

	async claimWork(userId: string, amount: number, cutoff: Date) {
		const result = await db
			.update(economy)
			.set({ coins: sql`${economy.coins} + ${amount}`, lastWork: new Date() })
			.where(
				and(
					eq(economy.userId, userId),
					or(isNull(economy.lastWork), lt(economy.lastWork, cutoff)),
				),
			)
			.returning();
		return result[0];
	}

	async setLastRob(userId: string) {
		await db
			.update(economy)
			.set({ lastRob: new Date() })
			.where(eq(economy.userId, userId));
	}

	// Removes up to `amount` coins without going below zero (currency sink).
	async burn(userId: string, amount: number) {
		await db
			.update(economy)
			.set({ coins: sql`GREATEST(${economy.coins} - ${amount}, 0)` })
			.where(eq(economy.userId, userId));
	}

	// Atomically moves coins between users. `credit` can be lower than
	// `deduct` (the difference is burned, e.g. transfer tax). The balance
	// guard prevents overdrawing under concurrent operations.
	async transfer(
		fromId: string,
		toId: string,
		deduct: number,
		credit: number,
	): Promise<boolean> {
		return await db.transaction(async (tx) => {
			const debited = await tx
				.update(economy)
				.set({ coins: sql`${economy.coins} - ${deduct}` })
				.where(and(eq(economy.userId, fromId), gte(economy.coins, deduct)))
				.returning();
			if (!debited.length) return false;
			await tx
				.insert(economy)
				.values({ userId: toId, coins: credit })
				.onConflictDoUpdate({
					target: economy.userId,
					set: { coins: sql`${economy.coins} + ${credit}` },
				});
			return true;
		});
	}

	async getTop(limit: number) {
		return await db
			.select({ userId: economy.userId, coins: economy.coins })
			.from(economy)
			.orderBy(desc(economy.coins))
			.limit(limit);
	}
}

export const economyRepository = new EconomyRepository();
