import { Command, type CommandContext, Declare, Middlewares } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "../../config/config";
import { inviteService } from "../../services/inviteService";
import { Embeds } from "../../utils/embeds";

@Declare({
	name: "delinvites",
	description: "Eliminar todas las invitaciones del servidor (excepto vanity)",
	props: {
		requiredRoles: [CONFIG.ROLES.ADMIN],
	},
})
@Middlewares(["auth"])
export default class DelInvitesCommand extends Command {
	override async run(ctx: CommandContext) {
		const guildId = ctx.guildId;
		if (!guildId) return;

		await ctx.deferReply(true);

		const [guild, allInvites] = await Promise.all([
			ctx.client.guilds.fetch(guildId).catch(() => null),
			ctx.client.invites.guilds.list(guildId).catch(() => []),
		]);

		const vanityCode = guild?.vanityUrlCode;
		const toDelete = allInvites.filter((inv) => inv.code !== vanityCode);

		let deleted = 0;
		for (const invite of toDelete) {
			await ctx.client.invites.delete(invite.code).catch(() => {});
			inviteService.cacheRemove(invite.code, guildId);
			deleted++;
		}

		await ctx.editOrReply({
			embeds: [
				Embeds.successEmbed(
					"Invitaciones eliminadas",
					`Se eliminaron **${deleted}** invitaciones del servidor.${vanityCode ? `\nLa invite vanity \`${vanityCode}\` fue conservada.` : ""}`,
				),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
}
