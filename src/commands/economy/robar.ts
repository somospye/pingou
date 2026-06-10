import {
	type CommandContext,
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
		description: "Usuario al que intentar robar",
		required: true,
	}),
};

@Declare({
	name: "robar",
	description: "Intenta robar PyE Coins a otro usuario",
})
@Options(options)
export class RobSubCommand extends SubCommand {
	override async run(ctx: CommandContext<typeof options>) {
		const target = ctx.options.usuario;

		if (target.id === ctx.author.id) {
			return ctx.write({
				embeds: [Embeds.errorEmbed("Error", "No puedes robarte a ti mismo.")],
				flags: MessageFlags.Ephemeral,
			});
		}

		if (target.bot) {
			return ctx.write({
				embeds: [Embeds.errorEmbed("Error", "No puedes robarle a un bot.")],
				flags: MessageFlags.Ephemeral,
			});
		}

		const result = await economyService.rob(ctx.author.id, target.id);

		if (!result.ok) {
			const embed =
				result.reason === "cooldown"
					? Embeds.errorEmbed(
							"Todavía te están buscando",
							`Podrás intentar otro robo <t:${result.availableAt}:R>.`,
						)
					: Embeds.errorEmbed(
							"Objetivo sin fondos",
							`<@${target.id}> no tiene suficientes ${CONFIG.ECONOMY.CURRENCY} como para que valga la pena.`,
						);
			return ctx.write({ embeds: [embed], flags: MessageFlags.Ephemeral });
		}

		if (result.success) {
			return ctx.write({
				embeds: [
					Embeds.successEmbed(
						"Robo exitoso",
						`Le robaste **${result.stolen} ${CONFIG.ECONOMY.CURRENCY}** a <@${target.id}>.`,
					),
				],
			});
		}

		await ctx.write({
			embeds: [
				Embeds.errorEmbed(
					"Te atraparon",
					`Fallaste el robo a <@${target.id}> y pagaste una multa de **${result.fine} ${CONFIG.ECONOMY.CURRENCY}**.`,
				),
			],
		});
	}
}
