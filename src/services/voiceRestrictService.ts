import type { UsingClient } from "seyfert";
import { CONFIG } from "@/config";
import { cooldownRepository } from "@/repositories/cooldownRepository";
import { Embeds } from "@/utils/embeds";

const KEY_PREFIX = "voice_restrict:";

function restrictionId(userId: string, guildId: string) {
	return `${userId}:${KEY_PREFIX}${guildId}`;
}

async function scheduleRemoval(
	client: UsingClient,
	userId: string,
	guildId: string,
	expiresAt: Date,
) {
	const roleId = CONFIG.RESTRICTIONS.VOZ;
	if (!roleId) return;

	const delay = Math.max(0, expiresAt.getTime() - Date.now());

	setTimeout(async () => {
		await client.members.removeRole(guildId, userId, roleId).catch(() => {});
		await cooldownRepository.deleteById(restrictionId(userId, guildId));

		const guild = await client.guilds.fetch(guildId).catch(() => null);
		const guildName = guild?.name ?? "el servidor";

		await client.users
			.createDM(userId)
			.then((dm) =>
				dm.messages.write({
					embeds: [Embeds.voiceUnrestrictDMEmbed(guildName)],
				}),
			)
			.catch(() => {});
	}, delay);
}

async function saveRestriction(
	userId: string,
	guildId: string,
	expiresAt: Date,
) {
	const key = `${KEY_PREFIX}${guildId}`;
	await cooldownRepository.upsert(
		restrictionId(userId, guildId),
		userId,
		key,
		expiresAt,
	);
}

async function recoverOnStartup(client: UsingClient) {
	const roleId = CONFIG.RESTRICTIONS.VOZ;
	if (!roleId) return;

	const restrictions = await cooldownRepository.findByKeyPrefix(KEY_PREFIX);

	for (const restriction of restrictions) {
		const guildId = restriction.key.slice(KEY_PREFIX.length);

		if (restriction.expiresAt <= new Date()) {
			await client.members
				.removeRole(guildId, restriction.userId, roleId)
				.catch(() => {});
			await cooldownRepository.deleteById(restriction.id);
		} else {
			await scheduleRemoval(
				client,
				restriction.userId,
				guildId,
				restriction.expiresAt,
			);
		}
	}
}

export const voiceRestrictService = {
	saveRestriction,
	scheduleRemoval,
	recoverOnStartup,
};
