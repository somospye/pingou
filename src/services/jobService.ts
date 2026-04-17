import type { UsingClient } from "seyfert";
import { CONFIG } from "../config/config";
import { jobRepository } from "../repositories/jobRepository";
import { reputationRepository } from "../repositories/reputationRepository";

export class JobService {
	async createPendingJob(data: {
		id: string;
		userId: string;
		title: string;
		description: string;
		requirements: string;
		salary?: string;
		contact: string;
	}) {
		return await jobRepository.createPending(data);
	}

	async getPendingJob(id: string) {
		return await jobRepository.findPendingById(id);
	}

	async deletePendingJob(id: string) {
		return await jobRepository.deletePending(id);
	}

	async checkAndAssignPriorityRole(
		client: UsingClient,
		guildId: string,
		userId: string,
	) {
		const points = await reputationRepository.getReputation(userId);
		if (points >= CONFIG.REPUTATION_FOR_PRIORITY) {
			try {
				const member = await client.members.fetch(guildId, userId);
				if (
					member &&
					!member.roles.keys.includes(CONFIG.ROLES.PRIORITY_RECRUITER)
				) {
					await member.roles.add(CONFIG.ROLES.PRIORITY_RECRUITER);
					return true;
				}
			} catch (error) {
				console.error(error);
			}
		}
		return false;
	}
}

export const jobService = new JobService();
