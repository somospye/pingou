import { eq } from "drizzle-orm";
import { db } from "@/database";
import { type JobType, schedules } from "@/database/schemas/schedules";

export class SchedulerRepository {
	async upsert(id: string, userId: string, jobType: JobType, expiresAt: Date) {
		return await db
			.insert(schedules)
			.values({ id, userId, jobType, expiresAt })
			.onConflictDoUpdate({
				target: schedules.id,
				set: { expiresAt },
			});
	}

	async deleteById(id: string) {
		return await db.delete(schedules).where(eq(schedules.id, id));
	}

	async findByJobType(jobType: JobType) {
		return await db
			.select()
			.from(schedules)
			.where(eq(schedules.jobType, jobType));
	}

	async findAll() {
		return await db.select().from(schedules);
	}
}

export const schedulerRepository = new SchedulerRepository();
