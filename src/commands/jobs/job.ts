import {
	Command,
	type CommandContext,
	Declare,
	Label,
	Middlewares,
	Modal,
	TextInput,
} from "seyfert";
import { MessageFlags, TextInputStyle } from "seyfert/lib/types";
import { CONFIG } from "@/config";

@Declare({
	name: "empleo",
	description: "Publica una nueva oferta de empleo",
	props: {
		cooldown: 604800,
		cooldownKey: "job-publish",
	},
})
@Middlewares(["cooldown"])
export default class JobCommand extends Command {
	override async run(ctx: CommandContext) {
		if (ctx.member?.roles.keys.includes(CONFIG.RESTRICTIONS.EMPLEOS)) {
			return ctx.editOrReply({
				content: "❌ Tienes restringido el uso de este comando.",
				flags: MessageFlags.Ephemeral,
			});
		}

		const modal = new Modal()
			.setCustomId("job-modal")
			.setTitle("Nueva Oferta de Empleo")
			.setComponents([
				new Label()
					.setLabel("Título del puesto")
					.setComponent(
						new TextInput()
							.setCustomId("title")
							.setPlaceholder("Ej: Senior Frontend Developer")
							.setStyle(TextInputStyle.Short)
							.setRequired(true),
					),
				new Label()
					.setLabel("Descripción")
					.setComponent(
						new TextInput()
							.setCustomId("description")
							.setPlaceholder("Describe brevemente el rol...")
							.setStyle(TextInputStyle.Paragraph)
							.setRequired(true),
					),
				new Label()
					.setLabel("Requisitos")
					.setComponent(
						new TextInput()
							.setCustomId("requirements")
							.setPlaceholder("Ej: 3+ años React, Inglés avanzado...")
							.setStyle(TextInputStyle.Paragraph)
							.setRequired(true),
					),
				new Label()
					.setLabel("Salario / Pago")
					.setComponent(
						new TextInput()
							.setCustomId("salary")
							.setPlaceholder("Ej: $3000 - $5000 USD / pago mensual")
							.setStyle(TextInputStyle.Short)
							.setRequired(true),
					),
				new Label()
					.setLabel("Contacto / Link")
					.setComponent(
						new TextInput()
							.setCustomId("contact")
							.setPlaceholder("Email o link de postulación (o MD)")
							.setStyle(TextInputStyle.Short)
							.setRequired(true),
					),
			]);

		if (ctx.interaction) {
			return await ctx.interaction.modal(modal);
		}
	}
}
