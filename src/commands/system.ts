import { Command, type CommandContext, Declare } from "seyfert";
import { CONFIG } from "@/config";
import { Embeds } from "@/utils/embeds";
import { formatBytes, formatUptime, getSystemStats } from "@/utils/system";

@Declare({
	name: "system",
	description: "Muestra estadísticas del sistema (RAM, CPU, disco)",
	props: {
		requiredRoles: [CONFIG.ROLES.ADMIN],
	},
})
export default class SystemCommand extends Command {
	override async run(ctx: CommandContext) {
		const stats = await getSystemStats();

		const embed = Embeds.systemStatsEmbed(stats, formatBytes, formatUptime);
		await ctx.write({ embeds: [embed] });
	}
}
