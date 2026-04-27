import { db } from "../database";
import { repHistory } from "../database/schemas/repHistory";
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

	async getReputation(userId: string) {
		return await usersRepository.getRep(userId);
	}
}

export const reputationRepository = new ReputationRepository();
