import {
	Command,
	type CommandContext,
	createIntegerOption,
	createUserOption,
	Declare,
	Middlewares,
	Options,
} from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "../../config/config";
import { reputationService } from "../../services/reputationService";
import { Embeds } from "../../utils/embeds";

const options = {
	usuario: createUserOption({
		description: "Usuario al que agregar reputación",
		required: true,
	}),
	cantidad: createIntegerOption({
		description: "Cantidad de puntos a agregar (por defecto 1)",
		required: false,
		min_value: 1,
		max_value: 100,
	}),
};

@Declare({
	name: "add-rep",
	description: "Agrega puntos de reputación a un usuario",
	props: {
		requiredRoles: [
			CONFIG.ROLES.ADMIN,
			CONFIG.ROLES.MODERATOR,
			CONFIG.ROLES.HELPER,
		],
	},
})
@Options(options)
@Middlewares(["auth"])
export default class AddRepCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const { usuario, cantidad = 1 } = ctx.options;
		const guildId = ctx.guildId;
		if (!guildId) return;

		if (usuario.bot) {
			return ctx.write({
				embeds: [Embeds.errorEmbed("Error", "No podés darle rep a un bot.")],
				flags: MessageFlags.Ephemeral,
			});
		}

		const { points, prevPoints, newRoles } =
			await reputationService.addRepAndCheckRoles(
				ctx.client,
				guildId,
				usuario.id,
				cantidad,
			);

		if (CONFIG.CHANNELS.REP_LOG) {
			const roleText =
				newRoles.length > 0
					? `\nNuevo rol: ${newRoles.map((r) => `<@&${r}>`).join(", ")}`
					: "";
			ctx.client.messages
				.write(CONFIG.CHANNELS.REP_LOG, {
					content:
						`**${ctx.author.username}** le ha dado +${cantidad} rep al usuario: \`${usuario.username}\`` +
						` (Comando manual)` +
						`\n> *Puntos anteriores: ${prevPoints}. Puntos actuales: ${points}*${roleText}`,
				})
				.catch(() => {});
		}

		await ctx.write({
			embeds: [
				Embeds.successEmbed(
					"Reputación agregada",
					`Se ${cantidad === 1 ? "agregó **1 punto**" : `agregaron **${cantidad} puntos**`} de reputación a <@${usuario.id}>.\nPuntos actuales: **${points}**${newRoles.length > 0 ? `\nNuevo rol: ${newRoles.map((r) => `<@&${r}>`).join(", ")}` : ""}`,
				),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
}
