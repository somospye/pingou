import { type CommandContext, Declare, SubCommand } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { economyService } from "@/services/economyService";
import { Embeds } from "@/utils/embeds";

@Declare({
	name: "trabajar",
	description: "Trabaja para ganar PyE Coins",
})
export class WorkSubCommand extends SubCommand {
	override async run(ctx: CommandContext) {
		const result = await economyService.work(ctx.author.id);

		if (!result.ok) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Estás cansado",
						`Ya trabajaste hace poco. Podrás volver a trabajar <t:${result.availableAt}:R>.`,
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		await ctx.write({
			embeds: [
				Embeds.successEmbed(
					"Trabajo completado",
					`Trabajaste como **${result.job}** y ganaste **${result.amount} ${CONFIG.ECONOMY.CURRENCY}**. Ahora tienes **${result.balance}**.`,
				),
			],
		});
	}
}
