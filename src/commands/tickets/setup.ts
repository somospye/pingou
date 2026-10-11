import {
	ActionRow,
	Button,
	type CommandContext,
	Declare,
	Middlewares,
	SubCommand,
} from "seyfert";
import { ButtonStyle, MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { Embeds } from "@/utils/embeds";

@Declare({
	name: "setup",
	description: "Publica el panel para abrir tickets en este canal",
	props: {
		requiredRoles: [CONFIG.ROLES.ADMIN],
	},
})
@Middlewares(["auth"])
export class TicketSetupCommand extends SubCommand {
	override async run(ctx: CommandContext) {
		const channelId = ctx.channelId;
		if (!channelId) return;

		const button = new Button()
			.setCustomId("ticket:open")
			.setEmoji("🎫")
			.setLabel("Crear ticket")
			.setStyle(ButtonStyle.Primary);

		await ctx.client.messages.write(channelId, {
			embeds: [Embeds.ticketPanelEmbed()],
			components: [new ActionRow<Button>().setComponents([button])],
		});

		return ctx.write({
			embeds: [
				Embeds.successEmbed(
					"Panel publicado",
					"El panel de tickets fue publicado en este canal.",
				),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
}
