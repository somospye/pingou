import { ComponentCommand, type ComponentContext } from "seyfert";
import { aiHistoryService } from "@/services/aiHistoryService";
import { buildStatus } from "@/utils/threadNotices";

export const AI_FORGET_CONFIRM_PREFIX = "ai-forget-ok";
export const AI_FORGET_CANCEL_ID = "ai-forget-no";

type Ctx = ComponentContext<"Button">;

/** Botones de la confirmación de /olvidar. */
export default class AiForgetButton extends ComponentCommand {
	override componentType = "Button" as const;

	override filter(ctx: Ctx) {
		return (
			ctx.customId.startsWith(`${AI_FORGET_CONFIRM_PREFIX}:`) ||
			ctx.customId === AI_FORGET_CANCEL_ID
		);
	}

	override async run(ctx: Ctx) {
		if (ctx.customId === AI_FORGET_CANCEL_ID) {
			return ctx.update(
				buildStatus("Cancelado", "Tu historial sigue guardado."),
			);
		}

		// La confirmación es efímera, pero igual verificamos que sea del usuario
		const userId = ctx.customId.split(":")[1];
		if (ctx.author.id !== userId) {
			return ctx.update(buildStatus("Esta confirmación no es tuya"));
		}

		const deleted = await aiHistoryService.forget(userId).catch((err) => {
			console.error("Failed to delete AI history:", err);
			return null;
		});

		if (deleted === null) {
			return ctx.update(
				buildStatus(
					"No se pudo borrar el historial",
					"Prueba de nuevo en un rato.",
				),
			);
		}

		return ctx.update(
			buildStatus(
				"Historial borrado",
				deleted
					? "Pingou ya no recuerda tus conversaciones anteriores."
					: "No tenías conversaciones guardadas.",
			),
		);
	}
}
