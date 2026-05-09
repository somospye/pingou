import {
	Command,
	type CommandContext,
	createUserOption,
	Declare,
	Options,
} from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { reputationRepository } from "@/repositories/reputationRepository";
import { Embeds } from "@/utils/embeds";

const options = {
	usuario: createUserOption({
		description: "Usuario del que ver las stats (por defecto, tú mismo)",
		required: false,
	}),
};

@Declare({
	name: "stats",
	description: "Ve cuántos puntos de reputación tenés vos o algún usuario",
})
@Options(options)
export default class StatsCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const target = ctx.options.usuario ?? ctx.author;

		if (ctx.options.usuario?.bot) {
			return ctx.write({
				embeds: [Embeds.errorEmbed("Error", "Los bots no tienen reputación.")],
				flags: MessageFlags.Ephemeral,
			});
		}

		const points = await reputationRepository.getReputation(target.id);

		const sortedTiers = [...CONFIG.REP_TIERS].sort(
			(a, b) => b.minPoints - a.minPoints,
		);

		const currentTier = sortedTiers.find((t) => points >= t.minPoints) ?? null;

		const nextTier =
			sortedTiers
				.slice()
				.reverse()
				.find((t) => points < t.minPoints) ?? null;

		await ctx.write({
			embeds: [
				Embeds.repStatsEmbed({
					userId: target.id,
					username: target.username,
					avatarUrl: target.avatarURL(),
					points,
					currentTier,
					nextTier,
				}),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
}
