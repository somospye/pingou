import { createEvent } from "seyfert";
import { CONFIG } from "../config/config";
import { Embeds } from "../utils/embeds";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export default createEvent({
	data: { once: false, name: "guildMemberAdd" },
	async run(member, client) {
		const roleId = CONFIG.RESTRICTIONS.VOZ;
		if (!roleId) return;

		await client.members
			.addRole(member.guildId, member.id, roleId)
			.catch(() => {});

		const guild = await client.guilds.fetch(member.guildId).catch(() => null);
		const guildName = guild?.name ?? "el servidor";

		await client.users
			.createDM(member.id)
			.then((dm) =>
				dm.messages.write({ embeds: [Embeds.voiceRestrictDMEmbed(guildName)] }),
			)
			.catch(() => {});

		setTimeout(async () => {
			await client.members
				.removeRole(member.guildId, member.id, roleId)
				.catch(() => {});

			await client.users
				.createDM(member.id)
				.then((dm) =>
					dm.messages.write({
						embeds: [Embeds.voiceUnrestrictDMEmbed(guildName)],
					}),
				)
				.catch(() => {});
		}, SIX_HOURS_MS);
	},
});
