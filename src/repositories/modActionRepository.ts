import { and, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/database";
import { modActions, modUsageLimits } from "@/database/schemas/modActions";

interface Data {
	type: "ban" | "kick" | "mute" | "warn" | "restrict";
	targetUserId: string;
	moderatorId: string;
	guildId: string;
	reason: string;
	duration?: number;
	extra?: string;
}

export class ModActionRepository {
	async create(data: Data) {
		const results = await db.insert(modActions).values(data).returning();
		const row = results[0];
		if (!row) throw new Error("Failed to insert mod action");
		return row;
	}

	async findByTargetUser(targetUserId: string, guildId: string) {
		return await db
			.select()
			.from(modActions)
			.where(
				and(
					eq(modActions.targetUserId, targetUserId),
					eq(modActions.guildId, guildId),
				),
			)
			.orderBy(desc(modActions.createdAt));
	}

	async findByTargetUserAndType(
		targetUserId: string,
		guildId: string,
		type: "ban" | "kick" | "mute" | "warn" | "restrict",
	) {
		return await db
			.select()
			.from(modActions)
			.where(
				and(
					eq(modActions.targetUserId, targetUserId),
					eq(modActions.guildId, guildId),
					eq(modActions.type, type),
				),
			)
			.orderBy(desc(modActions.createdAt));
	}

	async getUsage(moderatorId: string, actionType: string) {
		const id = `${moderatorId}:${actionType}`;
		const result = await db
			.select()
			.from(modUsageLimits)
			.where(eq(modUsageLimits.id, id))
			.limit(1);

		if (!result[0]) return null;

		if (result[0].resetsAt < new Date()) {
			await db.delete(modUsageLimits).where(eq(modUsageLimits.id, id));
			return null;
		}

		return result[0];
	}

	async incrementUsage(moderatorId: string, actionType: string) {
		const id = `${moderatorId}:${actionType}`;
		const existing = await this.getUsage(moderatorId, actionType);

		if (existing) {
			await db
				.update(modUsageLimits)
				.set({ usageCount: existing.usageCount + 1 })
				.where(eq(modUsageLimits.id, id));
			return existing.usageCount + 1;
		}

		const now = new Date();
		const resetsAt = new Date(now);
		resetsAt.setUTCHours(23, 59, 59, 999);

		await db.insert(modUsageLimits).values({
			id,
			moderatorId,
			actionType,
			usageCount: 1,
			resetsAt,
		});

		return 1;
	}

	async cleanupExpiredLimits() {
		await db
			.delete(modUsageLimits)
			.where(lt(modUsageLimits.resetsAt, new Date()));
	}

	async getStatsByPeriod(guildId: string, since: Date) {
		const rows = await db
			.select({
				type: modActions.type,
				total: count(modActions.id),
			})
			.from(modActions)
			.where(
				and(eq(modActions.guildId, guildId), gte(modActions.createdAt, since)),
			)
			.groupBy(modActions.type)
			.orderBy(desc(count(modActions.id)));

		return rows;
	}

	async getTopModerators(guildId: string, since: Date, limit = 10) {
		const rows = await db
			.select({
				moderatorId: modActions.moderatorId,
				total: count(modActions.id),
				bans: sql<number>`cast(sum(case when ${modActions.type} = 'ban' then 1 else 0 end) as int)`,
				kicks: sql<number>`cast(sum(case when ${modActions.type} = 'kick' then 1 else 0 end) as int)`,
				mutes: sql<number>`cast(sum(case when ${modActions.type} = 'mute' then 1 else 0 end) as int)`,
				warns: sql<number>`cast(sum(case when ${modActions.type} = 'warn' then 1 else 0 end) as int)`,
				restricts: sql<number>`cast(sum(case when ${modActions.type} = 'restrict' then 1 else 0 end) as int)`,
			})
			.from(modActions)
			.where(
				and(eq(modActions.guildId, guildId), gte(modActions.createdAt, since)),
			)
			.groupBy(modActions.moderatorId)
			.orderBy(desc(count(modActions.id)))
			.limit(limit);

		return rows;
	}
}

export const modActionRepository = new ModActionRepository();
