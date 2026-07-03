import {
	ContextMenuCommand,
	Declare,
	Label,
	type MenuCommandContext,
	Middlewares,
	Modal,
	TextInput,
	type UserCommandInteraction,
} from "seyfert";
import { ApplicationCommandType, TextInputStyle } from "seyfert/lib/types";

@Declare({
	name: "Reportar usuario",
	type: ApplicationCommandType.User,
	props: {
		cooldown: 60,
		cooldownKey: "report",
	},
})
@Middlewares(["cooldown"])
export default class ReportUserMenu extends ContextMenuCommand {
	override async run(ctx: MenuCommandContext<UserCommandInteraction>) {
		const modal = new Modal()
			.setCustomId(`report:user:${ctx.target.id}`)
			.setTitle("Reportar usuario")
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
