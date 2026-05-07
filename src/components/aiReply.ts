import { ComponentCommand, type ComponentContext } from "seyfert";
import { aiService } from "@/services/ai";
import { Embeds } from "@/utils/embeds";

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

			const { text, usage } = await aiService.chat(
				prevMessages.map((m) => m.content),
			);

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

			const embeds = Embeds.aiReplyEmbeds(text, usage);

			for (const embed of embeds) {
				await ctx.client.messages.write(ctx.channelId, {
					embeds: [embed],
				});
			}
		} catch (error) {
			console.error("Error in AI reply button:", error);
			await ctx.editResponse({
				content:
					"❌ Ocurrió un error al generar la respuesta. Por favor, intentá más tarde.",
			});
		}
	}
}
