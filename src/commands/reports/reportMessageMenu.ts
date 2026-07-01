import {
	ContextMenuCommand,
	Declare,
	Label,
	type MenuCommandContext,
	type MessageCommandInteraction,
	Middlewares,
	Modal,
	TextInput,
} from "seyfert";
import { ApplicationCommandType, TextInputStyle } from "seyfert/lib/types";

@Declare({
	name: "Reportar mensaje",
	type: ApplicationCommandType.Message,
	props: {
		cooldown: 60,
		cooldownKey: "report",
	},
})
@Middlewares(["cooldown"])
export default class ReportMessageMenu extends ContextMenuCommand {
	override async run(ctx: MenuCommandContext<MessageCommandInteraction>) {
		const modal = new Modal()
			.setCustomId(`report:msg:${ctx.target.channelId}:${ctx.target.id}`)
			.setTitle("Reportar mensaje")
			.setComponents([
				new Label()
					.setLabel("Motivo")
					.setComponent(
						new TextInput()
							.setCustomId("motivo")
							.setPlaceholder("Describe el motivo del reporte...")
							.setStyle(TextInputStyle.Paragraph)
							.setRequired(true),
					),
			]);

		await ctx.modal(modal);
	}
}
