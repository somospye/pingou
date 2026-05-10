import { ComponentCommand, type ComponentContext } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { aiSourcesStore } from "@/services/aiSources";

/**
 * Handler del botón "📚 Ver fuentes" que aparece bajo respuestas IA cuando
 * se consultaron 2+ fuentes en investigación web. Responde ephemeral con
 * la lista numerada (los números coinciden con las citas [N] del answer).
 *
 * El customId es `ai-sources:<key>` donde key es un UUID-prefix de 8 chars
 * que indexa el store en memoria. Si el key expiró (1h) o no existe, le
 * dice al usuario que las fuentes ya no están disponibles.
 */
export default class AISourceButton extends ComponentCommand {
	override componentType = "Button" as const;

	override filter(ctx: ComponentContext<typeof this.componentType>) {
		return ctx.customId.startsWith("ai-sources:");
	}

	override async run(ctx: ComponentContext<typeof this.componentType>) {
		const key = ctx.customId.slice("ai-sources:".length);
		const urls = aiSourcesStore.get(key);

		if (!urls?.length) {
			return ctx.write({
				content:
					"Las fuentes de esta respuesta ya no están disponibles (expiraron tras una hora).",
				flags: MessageFlags.Ephemeral,
			});
		}

		const list = urls.map((u, i) => `${i + 1}. ${u}`).join("\n");
		return ctx.write({
			content: `**Fuentes consultadas:**\n${list}`,
			flags: MessageFlags.Ephemeral,
		});
	}
}
