import type { UsingClient } from "seyfert";
import type { JobType } from "@/database/schemas/schedules";
import { schedulerRepository } from "@/repositories/schedulerRepository";

type JobHandler = (client: UsingClient, userId: string) => Promise<void>;

class SchedulerService {
	private handlers = new Map<JobType, JobHandler>();
	private timers = new Map<string, NodeJS.Timeout>();

	register(jobType: JobType, handler: JobHandler) {
		this.handlers.set(jobType, handler);
	}

	async schedule(
		client: UsingClient,
		jobType: JobType,
		userId: string,
		delayMs: number,
	) {
		const id = `${jobType}:${userId}`;
		const expiresAt = new Date(Date.now() + delayMs);

		await schedulerRepository.upsert(id, userId, jobType, expiresAt);
		this.setTimer(client, jobType, userId, Math.max(0, delayMs));
	}

	async recoverOnStartup(client: UsingClient) {
		const pending = await schedulerRepository.findAll();

		for (const entry of pending) {
			const jobType = entry.jobType;

			if (!this.handlers.has(jobType)) {
				console.warn(
					`[scheduler] No hay handler para el tipo de trabajo: ${jobType}`,
				);
				continue;
			}

			const delay = entry.expiresAt.getTime() - Date.now();
			this.setTimer(client, jobType, entry.userId, Math.max(0, delay));
		}
	}

	private setTimer(
		client: UsingClient,
		jobType: JobType,
		userId: string,
		delayMs: number,
	) {
		const id = `${jobType}:${userId}`;
		// setTimeout hace overflow con valores mayores a 2^31-1 ms (~24.8 días), triggereandose al instance
		// https://nodejs.org/api/timers.html#settimeoutcallback-delay-args
		const safeDelay = Math.min(delayMs, 2 ** 31 - 1);

		const existing = this.timers.get(id);
		if (existing) clearTimeout(existing);

		const timer = setTimeout(async () => {
			this.timers.delete(id);
			await schedulerRepository.deleteById(id);

			const handler = this.handlers.get(jobType);
			if (handler) await handler(client, userId).catch(console.error);
		}, safeDelay);

		this.timers.set(id, timer);
	}
}

export const schedulerService = new SchedulerService();
