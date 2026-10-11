import {
	ComponentCommand,
	type ComponentContext,
	Label,
	Modal,
	TextInput,
} from "seyfert";
import { MessageFlags, TextInputStyle } from "seyfert/lib/types";
import { ticketService } from "@/services/ticketService";
import { Embeds } from "@/utils/embeds";

export default class TicketOpenButton extends ComponentCommand {
	override componentType = "Button" as const;

	override filter(ctx: ComponentContext<typeof this.componentType>) {
		return ctx.customId === "ticket:open";
	}

	override async run(ctx: ComponentContext<typeof this.componentType>) {
		const existing = await ticketService.getOpenTicketByUser(ctx.author.id);
		if (existing) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Ya tienes un ticket abierto",
						`Puedes continuar la conversación en <#${existing.threadId}>.`,
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		const modal = new Modal()
			.setCustomId("ticket:modal")
			.setTitle("Nuevo ticket de soporte")
			.setComponents([
				new Label()
					.setLabel("Asunto")
					.setComponent(
						new TextInput()
							.setCustomId("subject")
							.setPlaceholder("Resume tu problema en una línea")
							.setStyle(TextInputStyle.Short)
							.setLength({ max: 255 })
							.setRequired(true),
					),
				new Label()
					.setLabel("Descripción")
					.setComponent(
						new TextInput()
							.setCustomId("description")
							.setPlaceholder("Cuéntanos más detalles (opcional)")
							.setStyle(TextInputStyle.Paragraph)
							.setLength({ max: 1024 })
							.setRequired(false),
					),
			]);

		return ctx.interaction.modal(modal);
	}
}
