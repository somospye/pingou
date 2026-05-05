import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/database";
import { bumps } from "@/database/schemas/bumps";

export type LastBumpType = typeof bumps.$inferSelect & { remaining: number };

export class BumpRepository {
	public async upsert(userId: string) {
		return await db
			.insert(bumps)
			.values({ userId })
			.onConflictDoUpdate({
				target: bumps.userId,
				set: {
					bumps: sql`${bumps.bumps} + 1`,
					updatedAt: sql`now()`,
				},
			});
	}

	public async findLastBump(
		userId?: string,
	): Promise<LastBumpType | undefined> {
		const base = db
			.select({
				userId: bumps.userId,
				bumps: bumps.bumps,
				updatedAt: bumps.updatedAt,
				remaining: sql<number>`
                  GREATEST(
                      EXTRACT(EPOCH FROM (updated_at + interval '2 hours' - now())),
                      0
                  )
                `,
			})
			.from(bumps)
			.limit(1);

		const query = userId
			? base.where(eq(bumps.userId, userId))
			: base.orderBy(desc(bumps.updatedAt));

		const result = await query.execute();
		return result[0];
	}
}

export const bumpRepository = new BumpRepository();
