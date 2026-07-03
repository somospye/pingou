import {
	type CommandContext,
	createIntegerOption,
	createUserOption,
	Declare,
	Options,
	SubCommand,
} from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { economyService } from "@/services/economyService";
import { Embeds } from "@/utils/embeds";

const options = {
	usuario: createUserOption({
		description: "Usuario que recibirá los PyE Coins",
		required: true,
	}),
	cantidad: createIntegerOption({
		description: "Cantidad a transferir",
		required: true,
		min_value: 1,
	}),
};

@Declare({
	name: "transferir",
	description: "Transfiere PyE Coins a otro usuario",
})
@Options(options)
export class TransferSubCommand extends SubCommand {
	override async run(ctx: CommandContext<typeof options>) {
		const { usuario, cantidad } = ctx.options;

		if (usuario.id === ctx.author.id) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed("Error", "No puedes transferirte a ti mismo."),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		if (usuario.bot) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed("Error", "No puedes transferirle a un bot."),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		const result = await economyService.transfer(
			ctx.author.id,
			usuario.id,
			cantidad,
		);

		if (!result.ok) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Fondos insuficientes",
						`No tienes **${cantidad} ${CONFIG.ECONOMY.CURRENCY}** para transferir.`,
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		await ctx.write({
			embeds: [
				Embeds.successEmbed(
					"Transferencia realizada",
					`Transferiste **${cantidad} ${CONFIG.ECONOMY.CURRENCY}** a <@${usuario.id}>. Recibió **${result.received}** (impuesto: **${result.tax}**).`,
				),
			],
		});
	}
}
