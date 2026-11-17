import {
	ActionRow,
	Button,
	Command,
	type CommandContext,
	Container,
	Declare,
	TextDisplay,
} from "seyfert";
import { ButtonStyle, MessageFlags } from "seyfert/lib/types";
import {
	AI_FORGET_CANCEL_ID,
	AI_FORGET_CONFIRM_PREFIX,
} from "@/components/aiForgetButton";

/**
 * Pide confirmación antes de borrar el historial de IA del usuario. El
 * borrado lo hace `aiForgetButton.ts` al tocar "Borrar".
 */
@Declare({
	name: "olvidar",
	description: "Borra tu historial de conversación con la IA de Pingou",
})
export default class OlvidarCommand extends Command {
	override async run(ctx: CommandContext) {
		return ctx.write({
			components: [
				new Container()
					.setColor(0x5865f2)
					.addComponents(
						new TextDisplay().setContent(
							"**¿Borrar tu historial?**\n-# Pingou va a olvidar tus conversaciones anteriores. No se puede deshacer.",
						),
						new ActionRow<Button>().setComponents([
							new Button()
								.setCustomId(`${AI_FORGET_CONFIRM_PREFIX}:${ctx.author.id}`)
								.setLabel("Borrar")
								.setStyle(ButtonStyle.Danger),
							new Button()
								.setCustomId(AI_FORGET_CANCEL_ID)
								.setLabel("Cancelar")
								.setStyle(ButtonStyle.Secondary),
						]),
					),
			],
			flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
		});
	}
}
