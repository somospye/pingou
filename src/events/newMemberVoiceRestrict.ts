import { createEvent } from "seyfert";
import { CONFIG } from "@/config";
import { inviteRepository } from "@/repositories/inviteRepository";
import { usersRepository } from "@/repositories/usersRepository";
import { inviteService } from "@/services/inviteService";
import { voiceRestrictService } from "@/services/voiceRestrictService";
import { Embeds } from "@/utils/embeds";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export default createEvent({
	data: { once: false, name: "guildMemberAdd" },
	async run(member, client) {
		await usersRepository.findOrCreate(member.id);
		await handleVoiceRestrict(member, client);
		await handleInviteLog(member, client);
	},
});

async function handleVoiceRestrict(
	member: { id: string; guildId: string },
	client: Parameters<typeof voiceRestrictService.scheduleRemoval>[0],
) {
	const roleId = CONFIG.RESTRICTIONS.VOZ;
	if (!roleId) return;

	await client.members
		.addRole(member.guildId, member.id, roleId)
		.catch(() => {});

	if (CONFIG.ROLES.NOVATO) {
		await client.members
			.addRole(member.guildId, member.id, CONFIG.ROLES.NOVATO)
			.catch(() => {});
	}

	const expiresAt = new Date(Date.now() + SIX_HOURS_MS);
	await voiceRestrictService.saveRestriction(
		member.id,
		member.guildId,
		expiresAt,
	);

	const guild = await client.guilds.fetch(member.guildId).catch(() => null);
	const guildName = guild?.name ?? "el servidor";

	await client.users
		.createDM(member.id)
		.then((dm) =>
			dm.messages.write({ embeds: [Embeds.voiceRestrictDMEmbed(guildName)] }),
		)
		.catch(() => {});

	await voiceRestrictService.scheduleRemoval(
		client,
		member.id,
		member.guildId,
		expiresAt,
	);
}

async function handleInviteLog(
	member: {
		id: string;
		guildId: string;
		username: string;
		user: { avatarURL(): string };
	},
	client: Parameters<typeof inviteService.detectUsedInvite>[0],
) {
	const channelId = CONFIG.CHANNELS.JOIN_LOG;

	const invite = await inviteService.detectUsedInvite(client, member.guildId);

	let inviterStats: { totalInvites: number; currentMembers: number } | null =
		null;

	if (invite?.inviter?.id) {
		await inviteRepository
			.logJoin(invite.code, invite.inviter.id, member.id, member.guildId)
			.catch(() => {});
		await inviteRepository
			.incrementStat(invite.inviter.id, member.guildId)
			.catch(() => {});
		inviterStats = await inviteRepository
			.getStat(invite.inviter.id, member.guildId)
			.catch(() => null);
	} else if (invite) {
		await inviteRepository
			.logJoin(invite.code, null, member.id, member.guildId)
			.catch(() => {});
	}

	if (!channelId) return;

	await client.messages
		.write(channelId, {
			embeds: [
				Embeds.memberJoinEmbed({
					userId: member.id,
					username: member.username,
					avatarUrl: member.user.avatarURL(),
					inviteCode: invite?.code ?? null,
					inviterId: invite?.inviter?.id ?? null,
					inviteUses: invite?.uses ?? null,
					inviteMaxUses: invite?.maxUses ?? null,
					inviteMaxAge: invite?.maxAge ?? null,
					inviteCreatedAt: invite?.createdAt ?? null,
					inviterStats,
				}),
			],
		})
		.catch(() => {});
}
