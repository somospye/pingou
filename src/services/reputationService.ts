import type { GuildMemberStructure, UsingClient } from "seyfert";
import { CONFIG } from "@/config";
import { reputationRepository } from "@/repositories/reputationRepository";
import { Embeds } from "@/utils/embeds";

export interface CreateRepLogI {
	receiverId: string;
	receiverName: string;
	giverId: string;
	giverName: string;
	points: number;
	newRoles: string[];
}

export interface AddRep {
	guildId: string;
	receiverId: string;
	giverId: string;
	amount?: number;
	reason?: string;
}

export class ReputationService {
	async addRepAndCheckRoles(
		client: UsingClient,
		data: AddRep,
	): Promise<{
		points: number;
		prevPoints: number;
		addedRoles: string[];
		removedRoles: string[];
	}> {
		const { guildId, receiverId, giverId, amount = 1, reason = "ayuda" } = data;

		const prevPoints = await reputationRepository.getReputation(receiverId);
		const points = await reputationRepository.addReputation(
			receiverId,
			giverId,
			amount,
			reason,
		);

		let member: GuildMemberStructure;
		try {
			member = await client.members.fetch(guildId, receiverId);
		} catch {
			return { points, prevPoints, addedRoles: [], removedRoles: [] };
		}

		const { added, removed } = await this.syncMemberTierRoles(
			member,
			points,
			CONFIG.REP_TIERS,
			CONFIG.ROLES.NOVATO,
		);

		return {
			points,
			prevPoints,
			addedRoles: added,
			removedRoles: removed,
		};
	}

	async sendLogRep(client: UsingClient, data: CreateRepLogI) {
		const channelId = CONFIG.CHANNELS.REP_LOG;
		if (!channelId) {
			console.info(
				`[Rep] ${data.giverName} (${data.giverId}) le dio rep a ${data.receiverName} (${data.receiverId})`,
			);
			return;
		}

		const embed = Embeds.repLogEmbed(data);

		await client.messages.write(channelId, {
			embeds: [embed],
		});
	}

	private async syncMemberTierRoles(
		member: GuildMemberStructure,
		points: number,
		tiers: Tier[],
		novatoRoleId?: string,
	): Promise<{ added: string[]; removed: string[] }> {
		const currentTier = resolveTier(points, tiers);
		const memberRoles = new Set(member.roles.keys);
		const desired = currentTier?.roleId ?? null;

		const toAdd = desired && !memberRoles.has(desired) ? [desired] : [];
		const toRemove = [
			...tiers
				.map((t) => t.roleId)
				.filter((id) => id !== desired && memberRoles.has(id)),
			...(novatoRoleId && currentTier && memberRoles.has(novatoRoleId)
				? [novatoRoleId]
				: []),
		];

		await Promise.all([
			...toRemove.map((id) => member.roles.remove(id).catch(console.error)),
			...toAdd.map((id) => member.roles.add(id).catch(console.error)),
		]);

		return { added: toAdd, removed: toRemove };
	}
}

export const reputationService = new ReputationService();

type Tier = {
	minPoints: number;
	roleId: string;
};

function resolveTier(points: number, tiers: Tier[]): Tier | null {
	const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
	let current: Tier | null = null;

	for (const tier of sorted) {
		if (points >= tier.minPoints) {
			current = tier;
		} else {
			break;
		}
	}

	return current;
}
