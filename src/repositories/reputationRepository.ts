import { and, desc, gte, lt, sql } from "drizzle-orm";
import { db } from "@/database";
import { repHistory } from "@/database/schemas/repHistory";
import { users } from "@/database/schemas/users";
import { usersRepository } from "./usersRepository";

export type Period = "weekly" | "monthly" | "all";

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

	async getTopReputation(tipo: "rep" | "empleos", period: Period, limit = 10) {
		const column = tipo === "rep" ? users.rep : users.repEmpleos;

		const query = db
			.select({
				userId: users.userId,
				points: column,
			})
			.from(users)
			.orderBy(desc(column))
			.limit(limit);

		return await query;
	}

	async getTopNegativeRep(period: Period, limit = 10) {
		const now = new Date();
		let dateFilter: Date | null = null;

		if (period === "weekly") {
			dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		} else if (period === "monthly") {
			dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
		}

		const conditions = [lt(repHistory.points, 0)];

		if (dateFilter) {
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
