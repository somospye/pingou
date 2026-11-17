import { ComponentCommand, type ComponentContext } from "seyfert";
import { aiService } from "@/services/ai";
import { splitForDiscord } from "@/utils/aiReply";

export default class AIReplyButton extends ComponentCommand {
	override componentType = "Button" as const;

	override filter(ctx: ComponentContext<typeof this.componentType>) {
		return ctx.customId === "foro-respuesta-ia";
	}

	override async run(ctx: ComponentContext<typeof this.componentType>) {
		await ctx.deferReply(true);

		try {
			const prevMessages = await aiService.getLatestMessages(
				ctx.client,
				ctx.channelId,
				10,
			);

			if (!prevMessages) return;

			const { text } = await aiService.chat(prevMessages.map((m) => m.content));

			await ctx.client.messages.edit(
				ctx.interaction.message.id,
				ctx.channelId,
				{
					components: [],
				},
			);

			await ctx.editResponse({
				content: "✅ Respuesta generada y enviada al hilo.",
			});

			for (const chunk of splitForDiscord(text)) {
				await ctx.client.messages.write(ctx.channelId, { content: chunk });
			}
		} catch (error) {
			console.error("Error in AI reply button:", error);
			await ctx.editResponse({
				content: "No pude generar la respuesta. Prueba de nuevo en un rato.",
			});
		}
	}
}
