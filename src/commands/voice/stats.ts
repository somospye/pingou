import {
	type CommandContext,
	createUserOption,
	Declare,
	Options,
	SubCommand,
} from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { voiceActivityService } from "@/services/voiceActivityService";
import { Embeds } from "@/utils/embeds";

const options = {
	usuario: createUserOption({
		description: "Usuario del que ver la actividad (por defecto, tú mismo)",
		required: false,
	}),
};

@Declare({
	name: "stats",
	description: "Ve tus puntos y horas en canales de voz, o los de otro usuario",
})
@Options(options)
export class VoiceStatsCommand extends SubCommand {
	override async run(ctx: CommandContext<typeof options>) {
		const target = ctx.options.usuario ?? ctx.author;

		if (ctx.options.usuario?.bot) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed("Error", "Los bots no acumulan actividad de voz."),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		const stats = await voiceActivityService.getStats(target.id);

		await ctx.write({
			embeds: [
				Embeds.voiceStatsEmbed({
					userId: target.id,
					username: target.username,
					avatarUrl: target.avatarURL(),
					points: stats.points,
					totalMinutes: stats.totalMinutes,
				}),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
}
