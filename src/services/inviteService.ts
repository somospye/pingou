import type { UsingClient } from "seyfert";
import { inviteRepository } from "../repositories/inviteRepository";

class InviteService {
	private cache = new Map<string, Map<string, number>>();

	private async fetchInvites(client: UsingClient, guildId: string) {
		const result = await client.invites.guilds.list(guildId).catch(() => []);
		if (Array.isArray(result)) return result;
		if (result && typeof result === "object")
			return Object.values(result) as typeof result;
		return [];
	}

	async initGuild(client: UsingClient, guildId: string) {
		const currentInvites = await this.fetchInvites(client, guildId);
		const guildCache = new Map<string, number>();

		for (const invite of currentInvites) {
			guildCache.set(invite.code, invite.uses);

			if (invite.inviter) {
				await inviteRepository
					.upsertInvite(invite.code, invite.inviter.id, guildId, invite.uses)
					.catch(() => {});
			}
		}

		this.cache.set(guildId, guildCache);
	}

	async detectUsedInvite(client: UsingClient, guildId: string) {
		const guildCache = this.cache.get(guildId);
		const currentInvites = await this.fetchInvites(client, guildId);

		if (!guildCache) {
			const newCache = new Map<string, number>();
			for (const invite of currentInvites) {
				newCache.set(invite.code, invite.uses);
			}
			this.cache.set(guildId, newCache);
			return null;
		}

		let usedInvite: (typeof currentInvites)[number] | null = null;
		for (const invite of currentInvites) {
			const cached = guildCache.get(invite.code) ?? 0;
			if (invite.uses > cached) {
				usedInvite = invite;
				break;
			}
		}

		if (usedInvite) {
			await inviteRepository.incrementUses(usedInvite.code).catch(() => {});
		}

		const updatedCache = new Map<string, number>();
		for (const invite of currentInvites) {
			updatedCache.set(invite.code, invite.uses);
		}
		this.cache.set(guildId, updatedCache);

		return usedInvite;
	}

	async trackCreated(code: string, inviterId: string, guildId: string) {
		this.cache.get(guildId)?.set(code, 0);
		await inviteRepository
			.upsertInvite(code, inviterId, guildId, 0)
			.catch(() => {});
	}

	cacheRemove(code: string, guildId: string) {
		this.cache.get(guildId)?.delete(code);
	}
}

export const inviteService = new InviteService();
