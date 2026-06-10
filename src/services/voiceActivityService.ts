import type { UsingClient } from "seyfert";
import { CONFIG } from "@/config";
import { voiceActivityRepository } from "@/repositories/voiceActivityRepository";
import { voiceSessionRepository } from "@/repositories/voiceSessionRepository";

const MS_PER_MINUTE = 60 * 1000;

interface VoiceSnapshot {
	channelByUser: Map<string, string>;
	humansByChannel: Map<string, number>;
	mutedUsers: Set<string>;
}

export class VoiceActivityService {
	async startSession(userId: string, channelId: string, joinedAt = new Date()) {
		await voiceSessionRepository.upsert(userId, channelId, joinedAt);
	}

	async endSession(userId: string) {
		await voiceSessionRepository.deleteByUserId(userId);
	}

	async getStats(userId: string) {
		return await voiceActivityRepository.findByUserId(userId);
	}

	async getTop(limit = 10) {
		return await voiceActivityRepository.getTop(limit);
	}

	async runAwardCycle(client: UsingClient) {
		const sessions = await voiceSessionRepository.findAll();
		if (!sessions.length) return;

		const snapshot = await this.takeSnapshot(client);
		const now = new Date();

		for (const session of sessions) {
			const channelId = snapshot.channelByUser.get(session.userId);

			if (!channelId) {
				await voiceSessionRepository.deleteByUserId(session.userId);
				continue;
			}

			if (channelId !== session.channelId) {
				// Move missed by the gateway handler; restart tracking on the new channel
				await voiceSessionRepository.upsert(session.userId, channelId, now);
				continue;
			}

			const active =
				!snapshot.mutedUsers.has(session.userId) &&
				(snapshot.humansByChannel.get(channelId) ?? 0) >=
					CONFIG.VOICE_ACTIVITY.MIN_HUMANS;

			if (!active) {
				// Inactive interval does not count toward points
				await voiceSessionRepository.updateLastAwardedAt(session.userId, now);
				continue;
			}

			const elapsedMinutes = Math.floor(
				(now.getTime() - session.lastAwardedAt.getTime()) / MS_PER_MINUTE,
			);
			if (!elapsedMinutes) continue;

			await voiceActivityRepository.addMinutes(
				session.userId,
				elapsedMinutes,
				CONFIG.VOICE_ACTIVITY.MINUTES_PER_POINT,
			);
			// Advance by whole minutes only, carrying the sub-minute remainder
			await voiceSessionRepository.updateLastAwardedAt(
				session.userId,
				new Date(
					session.lastAwardedAt.getTime() + elapsedMinutes * MS_PER_MINUTE,
				),
			);
		}
	}

	async recoverOnStartup(client: UsingClient) {
		const sessions = await voiceSessionRepository.findAll();
		const snapshot = await this.takeSnapshot(client);
		const now = new Date();
		const sessionByUser = new Map(sessions.map((s) => [s.userId, s]));

		for (const session of sessions) {
			if (!snapshot.channelByUser.has(session.userId)) {
				await voiceSessionRepository.deleteByUserId(session.userId);
			}
		}

		for (const [userId, channelId] of snapshot.channelByUser) {
			const session = sessionByUser.get(userId);
			if (!session || session.channelId !== channelId) {
				await voiceSessionRepository.upsert(userId, channelId, now);
			}
		}
	}

	private async takeSnapshot(client: UsingClient): Promise<VoiceSnapshot> {
		const states =
			(await client.cache.voiceStates?.values(CONFIG.GUILD_ID)) ?? [];
		const channelByUser = new Map<string, string>();
		const humansByChannel = new Map<string, number>();
		const mutedUsers = new Set<string>();

		for (const state of states) {
			if (!state.channelId) continue;

			const user = await state.user().catch(() => null);
			if (!user || user.bot) continue;

			channelByUser.set(state.userId, state.channelId);
			humansByChannel.set(
				state.channelId,
				(humansByChannel.get(state.channelId) ?? 0) + 1,
			);
			if (state.selfMute || state.selfDeaf || state.mute || state.deaf) {
				mutedUsers.add(state.userId);
			}
		}

		return { channelByUser, humansByChannel, mutedUsers };
	}
}

export const voiceActivityService = new VoiceActivityService();
