import { Command, type CommandContext, Declare, Embed } from "seyfert";
import { CONFIG } from "../config/config";

@Declare({
	name: "ping",
	description: "Mira la latencia del bot",
	props: {
		requiredRoles: [CONFIG.ROLES.ADMIN]
	}
})
export default class PingCommand extends Command {
	override async run(ctx: CommandContext) {
		const latency = ctx.client.gateway.latency;

		const embed = new Embed()
			.setTitle(`**LATENCIA DEL BOT**`)
			.setDescription(`La latencia del bot es de ${latency}ms`)
			.setColor("Blue")
			.setTimestamp();

		await ctx.write({ embeds: [embed] });
	}
}
