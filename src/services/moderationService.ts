import type { UsingClient } from "seyfert";
import { CONFIG } from "@/config";
import { modActionRepository } from "@/repositories/modActionRepository";
import { getPeriodStart, type Period } from "@/utils/date";
import { Embeds } from "@/utils/embeds";

export type ModActionType = "ban" | "kick" | "mute" | "warn" | "restrict";

export class ModerationService {
	getTierWeight(roleIds: string[]): number {
		if (roleIds.includes(CONFIG.ROLES.ADMIN)) return 3;
		if (roleIds.includes(CONFIG.ROLES.MODERATOR)) return 2;
		if (roleIds.includes(CONFIG.ROLES.HELPER)) return 1;
		return 0;
	}

	getModeratorTier(roleIds: string[]): "admin" | "mod" | "helper" | null {
		if (roleIds.includes(CONFIG.ROLES.ADMIN)) return "admin";
		if (roleIds.includes(CONFIG.ROLES.MODERATOR)) return "mod";
		if (roleIds.includes(CONFIG.ROLES.HELPER)) return "helper";
		return null;
	}

	async checkLimit(
		moderatorId: string,
		moderatorRoles: string[],
		actionType: ModActionType,
	): Promise<{ allowed: boolean; remaining?: number; limit?: number }> {
		const tier = this.getModeratorTier(moderatorRoles);

		if (!tier) return { allowed: false };

		const limits = CONFIG.ROLE_LIMITS[tier];
		if (!limits) return { allowed: false };

		const limit = limits[actionType];

		if (limit === -1) return { allowed: true };
		if (limit === 0) return { allowed: false, remaining: 0, limit: 0 };

		const usage = await modActionRepository.getUsage(moderatorId, actionType);
		const currentCount = usage?.usageCount ?? 0;

		if (currentCount >= limit) return { allowed: false, remaining: 0, limit };

		return { allowed: true, remaining: limit - currentCount, limit };
	}

	async logAction(data: {
		type: ModActionType;
		targetUserId: string;
		moderatorId: string;
		guildId: string;
		reason: string;
		duration?: number;
		extra?: string;
	}) {
		const action = await modActionRepository.create(data);
		await modActionRepository.incrementUsage(data.moderatorId, data.type);
		return action;
	}

	async sendAuditLog(
		client: UsingClient,
		data: {
			caseId: number;
			type: ModActionType;
			targetUserId: string;
			targetTag: string;
			moderatorId: string;
			moderatorTag: string;
			reason: string;
			duration?: number;
			extra?: string;
			targetAvatar?: string;
		},
	) {
		const channelId = CONFIG.CHANNELS.MOD_LOG;
		if (!channelId) return;

		const embed = Embeds.modActionEmbed(data);

		await client.messages.write(channelId, {
			embeds: [embed],
		});
	}

	async getUserCases(targetUserId: string, guildId: string) {
		return modActionRepository.findByTargetUser(targetUserId, guildId);
	}

	async getUserWarns(targetUserId: string, guildId: string) {
		const sixMonthsAgo = new Date();
		sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 6);

		const allWarns = await modActionRepository.findByTargetUserAndType(
			targetUserId,
			guildId,
			"warn",
		);

		return allWarns.filter((w) => w.createdAt >= sixMonthsAgo);
	}

	async cleanupExpiredLimits() {
		await modActionRepository.cleanupExpiredLimits();
	}

	async getStats(guildId: string, period: Period) {
		const since = getPeriodStart(period);
		return modActionRepository.getStatsByPeriod(guildId, since);
	}

	async getTopModerators(guildId: string, period: Period, limit = 10) {
		const since = getPeriodStart(period);
		return modActionRepository.getTopModerators(guildId, since, limit);
	}
}

export const moderationService = new ModerationService();
