import { ComponentCommand, type ComponentContext } from "seyfert";
import { moderationService } from "@/services/moderationService";
import { Embeds } from "@/utils/embeds";
import {
	buildCasePaginationRow,
	fetchDisplayUser,
	getCasesChunk,
	getTotalCasePages,
} from "@/utils/moderation";

export default class CasePagination extends ComponentCommand {
	override componentType = "Button" as const;

	override filter(ctx: ComponentContext<typeof this.componentType>) {
		return (
			ctx.customId.startsWith("case-prev_") ||
			ctx.customId.startsWith("case-next_")
		);
	}

	override async run(ctx: ComponentContext<typeof this.componentType>) {
		const [action, userId, activePage] = ctx.customId.split("_");
		if (!action || !userId || !activePage) return;

		const isNext = action.includes("next");
		const currentPage = Number.parseInt(activePage, 10);
		const newPage = isNext ? currentPage + 1 : currentPage - 1;
		const guildId = ctx.guildId;
		if (!guildId) return;

		const allCases = await moderationService.getUserCases(userId, guildId);
		const totalPages = getTotalCasePages(allCases.length);
		const casesChunk = getCasesChunk(allCases, newPage);

		const targetUser = await fetchDisplayUser(ctx.client, userId);

		const row = buildCasePaginationRow(userId, newPage, totalPages);

		await ctx.update({
			embeds: [
				Embeds.casesEmbed({
					targetTag: targetUser.tag,
					targetId: userId,
					totalCases: allCases.length,
					page: newPage,
					totalPages,
					cases: casesChunk.map((c) => ({
						id: c.id,
						type: c.type,
						reason: c.reason,
						moderatorId: c.moderatorId,
						createdAt: c.createdAt,
					})),
				}),
			],
			components: [row],
		});
	}
}
