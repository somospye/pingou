import {
	ComponentCommand,
	type ComponentContext,
	Label,
	Modal,
	TextInput,
} from "seyfert";
import { TextInputStyle } from "seyfert/lib/types";
import { THREAD_REPORT_PREFIX } from "@/utils/threadNotices";

/**
 * Abre el mismo modal que el menú "Reportar mensaje", apuntando al post
 * original del hilo. El envío lo procesa `reportModal.ts`.
 */
export default class ThreadReportButton extends ComponentCommand {
	override componentType = "Button" as const;

	override filter(ctx: ComponentContext<typeof this.componentType>) {
		return ctx.customId.startsWith(`${THREAD_REPORT_PREFIX}:`);
	}

	override async run(ctx: ComponentContext<typeof this.componentType>) {
		const [, channelId, messageId] = ctx.customId.split(":");
		if (!channelId || !messageId) return;

		const modal = new Modal()
			.setCustomId(`report:msg:${channelId}:${messageId}`)
			.setTitle("Reportar publicación")
			.setComponents([
				new Label()
					.setLabel("Motivo")
					.setComponent(
						new TextInput()
							.setCustomId("motivo")
							.setPlaceholder("¿Qué tiene de sospechoso esta publicación?")
							.setStyle(TextInputStyle.Paragraph)
							.setRequired(true),
					),
			]);

		await ctx.interaction.modal(modal);
	}
}
