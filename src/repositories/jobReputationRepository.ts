import { usersRepository } from "./usersRepository";

export class JobReputationRepository {
	async addReputation(userId: string, points = 1) {
		return await usersRepository.incrementRepEmpleos(userId, points);
	}

	async getReputation(userId: string) {
		return await usersRepository.getRepEmpleos(userId);
	}
}

export const jobReputationRepository = new JobReputationRepository();
