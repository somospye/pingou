import {
	Command,
	type CommandContext,
	createIntegerOption,
	Declare,
	Options,
} from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { usersRepository } from "@/repositories/usersRepository";
import { Embeds } from "@/utils/embeds";

const options = {
	limite: createIntegerOption({
		description: "Cantidad de usuarios a mostrar (por defecto 10)",
		required: false,
		min_value: 1,
		max_value: 50,
	}),
};

@Declare({
	name: "top",
	description: "Muestra el top de usuarios con más reputación",
})
@Options(options)
export default class TopCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const limit = ctx.options.limite ?? 10;
		const topUsers = await usersRepository.getTopRep(limit);

		await ctx.write({
			embeds: [
				Embeds.repTopEmbed({
					users: topUsers.map((u) => ({
						userId: u.userId,
						points: u.rep,
					})),
				}),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
}
