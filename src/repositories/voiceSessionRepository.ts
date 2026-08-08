import { eq } from "drizzle-orm";
import { db } from "@/database";
import { voiceSessions } from "@/database/schemas/voiceSessions";

export class VoiceSessionRepository {
	async upsert(userId: string, channelId: string, joinedAt: Date) {
		await db
			.insert(voiceSessions)
			.values({ userId, channelId, joinedAt, lastAwardedAt: joinedAt })
			.onConflictDoUpdate({
				target: voiceSessions.userId,
				set: { channelId, joinedAt, lastAwardedAt: joinedAt },
			});
	}

	async updateLastAwardedAt(userId: string, lastAwardedAt: Date) {
		await db
			.update(voiceSessions)
			.set({ lastAwardedAt })
			.where(eq(voiceSessions.userId, userId));
	}

	async deleteByUserId(userId: string) {
		await db.delete(voiceSessions).where(eq(voiceSessions.userId, userId));
	}

	async findAll() {
		return await db.select().from(voiceSessions);
	}
}

export const voiceSessionRepository = new VoiceSessionRepository();
