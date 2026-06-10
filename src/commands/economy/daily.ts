import { type CommandContext, Declare, SubCommand } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { economyService } from "@/services/economyService";
import { Embeds } from "@/utils/embeds";

@Declare({
	name: "daily",
	description: "Reclama tu recompensa diaria de PyE Coins",
})
export class DailySubCommand extends SubCommand {
	override async run(ctx: CommandContext) {
		const result = await economyService.daily(ctx.author.id);

		if (!result.ok) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Recompensa no disponible",
						`Ya reclamaste tu recompensa diaria. Podrás volver a reclamarla <t:${result.availableAt}:R>.`,
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		await ctx.write({
			embeds: [
				Embeds.successEmbed(
					"Recompensa diaria",
					`Reclamaste **${result.amount} ${CONFIG.ECONOMY.CURRENCY}**. Ahora tienes **${result.balance}**.`,
				),
			],
		});
	}
}
