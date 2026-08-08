import { type CommandContext, Declare, SubCommand } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { voiceActivityService } from "@/services/voiceActivityService";
import { Embeds } from "@/utils/embeds";

@Declare({
	name: "top",
	description: "Muestra el top de usuarios con más actividad en voz",
})
export class VoiceTopCommand extends SubCommand {
	override async run(ctx: CommandContext) {
		const topUsers = await voiceActivityService.getTop(10);

		await ctx.write({
			embeds: [
				Embeds.voiceTopEmbed({
					users: topUsers.map((u) => ({
						userId: u.userId,
						points: u.points,
						totalMinutes: u.totalMinutes,
					})),
				}),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
}
