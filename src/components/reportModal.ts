import { ModalCommand, type ModalContext } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { type ReportData, reportService } from "@/services/reportService";

export default class ReportModal extends ModalCommand {
	override filter(ctx: ModalContext) {
		return ctx.customId.startsWith("report:");
	}

	override async run(ctx: ModalContext) {
		const reason = ctx.interaction.getInputValue("motivo", true) as string;
		const [, kind, first, second] = ctx.customId.split(":");

		let data: ReportData | null = null;

		if (kind === "user" && first) {
			data = {
				reporterId: ctx.author.id,
				reporterTag: ctx.author.username,
				reportedUserId: first,
				reason,
			};
		}

		if (kind === "msg" && first && second) {
			const message = await ctx.client.messages
				.fetch(second, first)
				.catch((err) => {
					console.error("Failed to fetch reported message:", err);
					return null;
				});

			if (!message) {
				return ctx.write({
					content:
						"No se pudo acceder al mensaje reportado. Es posible que haya sido eliminado.",
					flags: MessageFlags.Ephemeral,
				});
			}

			data = {
				reporterId: ctx.author.id,
				reporterTag: ctx.author.username,
				reportedUserId: message.author.id,
				reportedTag: message.author.username,
				reason,
				messageUrl: `https://discord.com/channels/${CONFIG.GUILD_ID}/${first}/${second}`,
				messageExcerpt: message.content
					? message.content.slice(0, 300)
					: undefined,
			};
		}

		if (!data) return;

		await reportService.sendReport(ctx.client, data);

		return ctx.write({
			content: "Tu reporte fue enviado al staff. Gracias.",
			flags: MessageFlags.Ephemeral,
		});
	}
}
