import {
	Command,
	type CommandContext,
	createUserOption,
	Declare,
	Middlewares,
	Options,
} from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { moderationService } from "@/services/moderationService";
import { Embeds } from "@/utils/embeds";
import {
	buildCasePaginationRow,
	CASES_PER_PAGE,
	getCasesChunk,
	getTotalCasePages,
} from "@/utils/moderation";

const options = {
	usuario: createUserOption({
		description: "El usuario del que quieres ver los casos",
		required: true,
	}),
};

@Declare({
	name: "cases",
	description: "Ve el historial de casos de un usuario",
})
@Options(options)
@Middlewares(["auth"])
export default class CasesCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const { usuario } = ctx.options;
		const guildId = ctx.guildId;
		if (!guildId) return;

		await ctx.deferReply(true);

		const allCases = await moderationService.getUserCases(usuario.id, guildId);
		const totalPages = getTotalCasePages(allCases.length);
		const page = 1;
		const casesChunk = getCasesChunk(allCases, page);
		const row = buildCasePaginationRow(usuario.id, page, totalPages);

		await ctx.editOrReply({
			embeds: [
				Embeds.casesEmbed({
					targetTag: usuario.username,
					targetId: usuario.id,
					totalCases: allCases.length,
					page,
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
			components: allCases.length > CASES_PER_PAGE ? [row] : [],
			flags: MessageFlags.Ephemeral,
		});
	}
}
