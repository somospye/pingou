import {
	Command,
	type CommandContext,
	createStringOption,
	Declare,
	Middlewares,
	Options,
} from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { moderationService } from "@/services/moderationService";
import type { Period } from "@/utils/date";
import { Embeds } from "@/utils/embeds";

const PERIOD_LABELS: Record<Period, string> = {
	weekly: "Última semana",
	monthly: "Último mes",
	all: "Todo el tiempo",
};

const options = {
	periodo: createStringOption({
		description: "Período de tiempo a consultar",
		required: true,
		choices: [
			{ name: "Semanal (últimos 7 días)", value: "weekly" },
			{ name: "Mensual (últimos 30 días)", value: "monthly" },
			{ name: "Todo el tiempo", value: "all" },
		] as const,
	}),
	vista: createStringOption({
		description: "Qué quieres ver",
		required: true,
		choices: [
			{ name: "📊 Estadísticas por tipo", value: "stats" },
			{ name: "🏆 Top moderadores", value: "top" },
		] as const,
	}),
};

@Declare({
	name: "modstats",
	description: "Estadísticas y top de moderación del servidor",
	props: {
		requiredRoles: [
			CONFIG.ROLES.ADMIN,
			CONFIG.ROLES.MODERATOR,
			CONFIG.ROLES.HELPER,
		],
	},
})
@Options(options)
@Middlewares(["auth"])
export default class ModStatsCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const { periodo, vista } = ctx.options;
		const guildId = ctx.guildId;

		if (!guildId) return;

		await ctx.deferReply(true);

		const period = periodo as Period;
		const periodLabel = PERIOD_LABELS[period] || "Periodo desconocido";

		if (vista === "stats") {
			const stats = await moderationService.getStats(guildId, period);
			const guild = await ctx.client.guilds.fetch(guildId);

			await ctx.editOrReply({
				embeds: [
					Embeds.modStatsEmbed({
						period: periodLabel,
						stats: stats.map((s) => ({ type: s.type, total: s.total })),
						guildName: guild.name,
					}),
				],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const top = await moderationService.getTopModerators(guildId, period);

		await ctx.editOrReply({
			embeds: [
				Embeds.modTopEmbed({
					period: periodLabel,
					moderators: top,
				}),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
}
