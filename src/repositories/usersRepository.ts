import { eq, sql } from "drizzle-orm";
import { db } from "@/database";
import { users } from "@/database/schemas/users";

export class UsersRepository {
	async findOrCreate(userId: string) {
		const results = await db
			.insert(users)
			.values({ userId })
			.onConflictDoNothing()
			.returning();
		if (results[0]) return results[0];
		const existing = await db
			.select()
			.from(users)
			.where(eq(users.userId, userId))
			.limit(1);
		return existing[0] ?? { userId, rep: 0, repEmpleos: 0 };
	}

	async incrementRep(userId: string, points: number) {
		await this.findOrCreate(userId);
		const result = await db
			.update(users)
			.set({ rep: sql`${users.rep} + ${points}` })
			.where(eq(users.userId, userId))
			.returning();
		return result[0]?.rep ?? 0;
	}

	async decrementRep(userId: string, points: number) {
		await this.findOrCreate(userId);
		const result = await db
			.update(users)
			.set({ rep: sql`${users.rep} - ${points}` })
			.where(eq(users.userId, userId))
			.returning();
		return result[0]?.rep ?? 0;
	}

	async getTopRep(limit = 10) {
		const result = await db
			.select()
			.from(users)
			.orderBy(sql`${users.rep} DESC`)
			.limit(limit);
		return result;
	}

	async incrementRepEmpleos(userId: string, points: number) {
		await this.findOrCreate(userId);
		const result = await db
			.update(users)
			.set({ repEmpleos: sql`${users.repEmpleos} + ${points}` })
			.where(eq(users.userId, userId))
			.returning();
		return result[0]?.repEmpleos ?? 0;
	}

	async getRep(userId: string) {
		const result = await db
			.select()
			.from(users)
			.where(eq(users.userId, userId))
			.limit(1);
		return result[0]?.rep ?? 0;
	}

	async getRepEmpleos(userId: string) {
		const result = await db
			.select()
			.from(users)
			.where(eq(users.userId, userId))
			.limit(1);
		return result[0]?.repEmpleos ?? 0;
	}
}

export const usersRepository = new UsersRepository();
