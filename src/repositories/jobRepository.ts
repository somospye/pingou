import { eq } from "drizzle-orm";
import { db } from "../database";
import { pendingJobs } from "../database/schemas/jobs";

export class JobRepository {
	async createPending(data: {
		id: string;
		userId: string;
		title: string;
		description: string;
		requirements: string;
		salary?: string;
		contact: string;
	}) {
		return await db.insert(pendingJobs).values(data);
	}

	async findPendingById(id: string) {
		const results = await db
			.select()
			.from(pendingJobs)
			.where(eq(pendingJobs.id, id))
			.limit(1);
		return results[0];
	}

	async deletePending(id: string) {
		return await db.delete(pendingJobs).where(eq(pendingJobs.id, id));
	}
}

export const jobRepository = new JobRepository();
