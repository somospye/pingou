import {
	type CommandContext,
	createUserOption,
	Declare,
	Options,
	SubCommand,
} from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { economyService } from "@/services/economyService";
import { Embeds } from "@/utils/embeds";

const options = {
	usuario: createUserOption({
		description: "Usuario a consultar (por defecto, tú)",
		required: false,
	}),
};

@Declare({
	name: "balance",
	description: "Muestra el balance de PyE Coins de un usuario",
})
@Options(options)
export class BalanceSubCommand extends SubCommand {
	override async run(ctx: CommandContext<typeof options>) {
		const user = ctx.options.usuario ?? ctx.author;

		if (user.bot) {
			return ctx.write({
				embeds: [Embeds.errorEmbed("Error", "Los bots no tienen PyE Coins.")],
				flags: MessageFlags.Ephemeral,
			});
		}

		const coins = await economyService.balance(user.id);

		await ctx.write({
			embeds: [
				Embeds.ecoBalanceEmbed({
					userId: user.id,
					username: user.username,
					avatarUrl: user.avatarURL(),
					coins,
				}),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
}
