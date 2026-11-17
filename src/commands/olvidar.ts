import { Command, type CommandContext, Declare } from "seyfert";
import { aiHistoryService } from "@/services/aiHistoryService";
import { buildStatus } from "@/utils/threadNotices";

@Declare({
	name: "olvidar",
	description: "Borra tu historial de conversación con la IA de Pingou",
})
export default class OlvidarCommand extends Command {
	override async run(ctx: CommandContext) {
		const deleted = await aiHistoryService
			.forget(ctx.author.id)
			.catch((err) => {
				console.error("Failed to delete AI history:", err);
				return null;
			});

		if (deleted === null) {
			return ctx.write(
				buildStatus(
					"No se pudo borrar el historial",
					"Intenta de nuevo en un rato.",
					{
						ephemeral: true,
					},
				),
			);
		}

		return ctx.write(
			buildStatus(
				"Historial borrado",
				deleted
					? "Pingou ya no recuerda tus conversaciones anteriores."
					: "No tenías conversaciones guardadas.",
				{ ephemeral: true },
			),
		);
	}
}
