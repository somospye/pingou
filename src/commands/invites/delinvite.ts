import {
	Command,
	type CommandContext,
	createStringOption,
	Declare,
	Middlewares,
	Options,
} from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "../../config/config";
import { inviteService } from "../../services/inviteService";
import { Embeds } from "../../utils/embeds";

const options = {
	codigo: createStringOption({
		description: "Código de la invitación (ej: abc123)",
		required: true,
		min_length: 2,
	}),
};

@Declare({
	name: "delinvite",
	description: "Eliminar una invitación del servidor",
	props: {
		requiredRoles: [CONFIG.ROLES.ADMIN],
	},
})
@Options(options)
@Middlewares(["auth"])
export default class DelInviteCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const code = ctx.options.codigo.trim();
		const guildId = ctx.guildId;
		if (!guildId) return;

		await ctx.deferReply(true);

		const guild = await ctx.client.guilds.fetch(guildId).catch(() => null);
		if (guild?.vanityUrlCode === code) {
			await ctx.editOrReply({
				embeds: [
					Embeds.errorEmbed(
						"No permitido",
						`La invite vanity \`${code}\` no puede ser eliminada.`,
					),
				],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		try {
			await ctx.client.invites.delete(code);
			inviteService.cacheRemove(code, guildId);

			await ctx.editOrReply({
				embeds: [
					Embeds.successEmbed(
						"Invitación eliminada",
						`La invitación \`${code}\` fue eliminada.`,
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		} catch {
			await ctx.editOrReply({
				embeds: [
					Embeds.errorEmbed(
						"Error",
						`No se pudo eliminar la invitación \`${code}\`. Verifica que exista y que el bot tenga permisos.`,
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}
	}
}
