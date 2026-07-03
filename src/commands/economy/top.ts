import {
	type CommandContext,
	createIntegerOption,
	Declare,
	Options,
	SubCommand,
} from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { economyService } from "@/services/economyService";
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
	description: "Muestra el top de usuarios con más PyE Coins",
})
@Options(options)
export class TopSubCommand extends SubCommand {
	override async run(ctx: CommandContext<typeof options>) {
		const limit = ctx.options.limite ?? 10;
		const users = await economyService.top(limit);

		await ctx.write({
			embeds: [Embeds.ecoTopEmbed({ users })],
			flags: MessageFlags.Ephemeral,
		});
	}
}
