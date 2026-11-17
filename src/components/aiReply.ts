import {
	ActionRow,
	Button,
	ComponentCommand,
	type ComponentContext,
} from "seyfert";
import { ButtonStyle } from "seyfert/lib/types";
import { aiService } from "@/services/ai";
import { cleanAiText, splitForDiscord, startTyping } from "@/utils/aiReply";

export const FORUM_AI_BUTTON_ID = "foro-respuesta-ia";

/**
 * Botón "Responder con IA" del mensaje de bienvenida en los posts de foro.
 * Al tocarlo se desactiva para siempre (así no se pide dos veces), Pingou
 * muestra "escribiendo..." en el hilo y responde al mensaje inicial.
 *
 * Sin el intent de Message Content, el texto del post y de los mensajes de
 * otros usuarios llega vacío: la IA trabaja con el título del hilo y con lo
 * que sí se puede leer (por ejemplo, mensajes de Pingou).
 */
export default class AIReplyButton extends ComponentCommand {
	override componentType = "Button" as const;

	override filter(ctx: ComponentContext<typeof this.componentType>) {
		return ctx.customId === FORUM_AI_BUTTON_ID;
	}

	override async run(ctx: ComponentContext<typeof this.componentType>) {
		// Responde a la interacción desactivando el botón en el mismo paso
		await ctx.update({
			components: [
				new ActionRow<Button>().setComponents([
					new Button()
						.setCustomId(FORUM_AI_BUTTON_ID)
						.setLabel("Responder con IA")
						.setEmoji("🤖")
						.setStyle(ButtonStyle.Primary)
						.setDisabled(true),
				]),
			],
		});

		const threadId = ctx.channelId;
		const stopTyping = startTyping(ctx.client, threadId);

		try {
			const thread = await ctx.client.channels
				.fetch(threadId)
				.catch(() => null);
			const title = thread && "name" in thread ? thread.name : "";

			const readable = (
				await aiService.getLatestMessages(ctx.client, threadId, 10)
			)
				.filter((m) => m.content?.trim())
				.reverse()
				.map((m) => `${m.author.username}: ${m.content}`);

			const question = [`Título del post: ${title}`, ...readable].join("\n");
			const plan = await aiService.planResponse(question);
			const text = plan.complex
				? (await aiService.chat([question], undefined, "COMPLEX")).text
				: plan.answer;

			stopTyping();
			for (const [i, chunk] of splitForDiscord(cleanAiText(text)).entries()) {
				await ctx.client.messages.write(threadId, {
					content: chunk,
					// El mensaje inicial de un post comparte id con el hilo
					...(i === 0
						? {
								message_reference: {
									message_id: threadId,
									fail_if_not_exists: false,
								},
							}
						: {}),
				});
			}
		} catch (error) {
			console.error("Error in AI reply button:", error);
			stopTyping();
			await ctx.client.messages
				.write(threadId, {
					content:
						"No pude generar la respuesta. Prueba mencionándome con tu pregunta.",
				})
				.catch(() => {});
		}
	}
}
