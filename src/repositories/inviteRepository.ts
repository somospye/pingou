import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/database";
import { inviteJoins } from "@/database/schemas/inviteJoins";
import { inviteStats } from "@/database/schemas/inviteStats";
import { invites } from "@/database/schemas/invites";

export class InviteRepository {
	async upsertInvite(
		code: string,
		inviterId: string,
		guildId: string,
		uses: number,
	) {
		return await db
			.insert(invites)
			.values({ code, inviterId, guildId, uses })
			.onConflictDoUpdate({
				target: invites.code,
				set: { uses },
			});
	}

	async incrementUses(code: string) {
		return await db
			.update(invites)
			.set({ uses: sql`${invites.uses} + 1` })
			.where(eq(invites.code, code));
	}

	async findInvitesByInviterAndGuild(inviterId: string, guildId: string) {
		return await db
			.select()
			.from(invites)
			.where(
				and(eq(invites.inviterId, inviterId), eq(invites.guildId, guildId)),
			);
	}

	async logJoin(
		inviteCode: string,
		inviterId: string | null,
		userId: string,
		guildId: string,
	) {
		return await db
			.insert(inviteJoins)
			.values({ inviteCode, inviterId, userId, guildId });
	}

	async findLatestJoin(userId: string, guildId: string) {
		const result = await db
			.select()
			.from(inviteJoins)
			.where(
				and(eq(inviteJoins.userId, userId), eq(inviteJoins.guildId, guildId)),
			)
			.orderBy(desc(inviteJoins.joinedAt))
			.limit(1);
		return result[0] ?? null;
	}

	async findJoinsByCode(inviteCode: string) {
		return await db
			.select()
			.from(inviteJoins)
			.where(eq(inviteJoins.inviteCode, inviteCode));
	}

	async findJoinsByInviterAndGuild(inviterId: string, guildId: string) {
		return await db
			.select()
			.from(inviteJoins)
			.where(
				and(
					eq(inviteJoins.inviterId, inviterId),
					eq(inviteJoins.guildId, guildId),
				),
			);
	}

	async incrementStat(inviterId: string, guildId: string) {
		return await db
			.insert(inviteStats)
			.values({ inviterId, guildId, totalInvites: 1, currentMembers: 1 })
			.onConflictDoUpdate({
				target: [inviteStats.inviterId, inviteStats.guildId],
				set: {
					totalInvites: sql`${inviteStats.totalInvites} + 1`,
					currentMembers: sql`${inviteStats.currentMembers} + 1`,
				},
			});
	}

	async decrementStat(inviterId: string, guildId: string) {
		return await db
			.update(inviteStats)
			.set({
				currentMembers: sql`GREATEST(${inviteStats.currentMembers} - 1, 0)`,
			})
			.where(
				and(
					eq(inviteStats.inviterId, inviterId),
					eq(inviteStats.guildId, guildId),
				),
			);
	}

	async getStat(inviterId: string, guildId: string) {
		const result = await db
			.select()
			.from(inviteStats)
			.where(
				and(
					eq(inviteStats.inviterId, inviterId),
					eq(inviteStats.guildId, guildId),
				),
			)
			.limit(1);
		return result[0] ?? { totalInvites: 0, currentMembers: 0 };
	}
}

export const inviteRepository = new InviteRepository();
