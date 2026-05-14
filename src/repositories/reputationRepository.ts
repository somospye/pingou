import { and, desc, gte, lt, sql } from "drizzle-orm";
import { db } from "@/database";
import { repHistory } from "@/database/schemas/repHistory";
import { users } from "@/database/schemas/users";
import { getPeriodStart, type Period } from "@/utils/date";
import { usersRepository } from "./usersRepository";

export class ReputationRepository {
	async addReputation(
		userId: string,
		issuedBy: string,
		points = 1,
		reason = "ayuda",
	) {
		await db.insert(repHistory).values({ issuedBy, userId, reason, points });
		return await usersRepository.incrementRep(userId, points);
	}

	async removeReputation(
		userId: string,
		issuedBy: string,
		points = 1,
		reason = "manual",
	) {
		await db
			.insert(repHistory)
			.values({ issuedBy, userId, reason, points: -points });
		return await usersRepository.decrementRep(userId, points);
	}

	async getReputation(userId: string) {
		return await usersRepository.getRep(userId);
	}

	async getTopNegativeRep(period: Period, limit = 10) {
		const dateFilter = getPeriodStart(period);

		const conditions = [lt(repHistory.points, 0)];

		if (dateFilter.getTime() > 0) {
			conditions.push(gte(repHistory.createdAt, dateFilter));
		}

		const query = db
			.select({
				userId: repHistory.userId,
				points: sql<number>`SUM(${repHistory.points})`.as("total_points"),
			})
			.from(repHistory)
			.where(and(...conditions))
			.groupBy(repHistory.userId)
			.orderBy(sql`SUM(${repHistory.points}) ASC`)
			.limit(limit);

		return await query;
	}
}

export const reputationRepository = new ReputationRepository();
