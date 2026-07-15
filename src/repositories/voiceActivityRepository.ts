import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/database";
import { voiceActivity } from "@/database/schemas/voiceActivity";

export class VoiceActivityRepository {
	// Awards 1 point each time total_minutes crosses a multiple of
	// minutesPerPoint, so the remainder carries over between cycles.
	async addMinutes(userId: string, minutes: number, minutesPerPoint: number) {
		await db
			.insert(voiceActivity)
			.values({
				userId,
				points: Math.floor(minutes / minutesPerPoint),
				totalMinutes: minutes,
			})
			.onConflictDoUpdate({
				target: voiceActivity.userId,
				set: {
					points: sql`${voiceActivity.points} + (${voiceActivity.totalMinutes} + ${minutes}) / ${minutesPerPoint} - ${voiceActivity.totalMinutes} / ${minutesPerPoint}`,
					totalMinutes: sql`${voiceActivity.totalMinutes} + ${minutes}`,
				},
			});
	}

	async findByUserId(userId: string) {
		const result = await db
			.select()
			.from(voiceActivity)
			.where(eq(voiceActivity.userId, userId))
			.limit(1);
		return result[0] ?? { userId, points: 0, totalMinutes: 0 };
	}

	async getTop(limit = 10) {
		return await db
			.select()
			.from(voiceActivity)
			.orderBy(desc(voiceActivity.points))
			.limit(limit);
	}
}

export const voiceActivityRepository = new VoiceActivityRepository();
