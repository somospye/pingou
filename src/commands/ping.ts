import { Command, type CommandContext, Declare } from "seyfert";
import { CONFIG } from "../config/config";
import { Embeds } from "../utils/embeds";

@Declare({
	name: "ping",
	description: "Mira la latencia del bot",
	props: {
		requiredRoles: [CONFIG.ROLES.ADMIN],
	},
})
export default class PingCommand extends Command {
	override async run(ctx: CommandContext) {
		const latency = ctx.client.gateway.latency;
		await ctx.write({ embeds: [Embeds.pingEmbed(latency)] });
	}
}
