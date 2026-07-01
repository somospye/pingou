import {
	Command,
	type CommandContext,
	createStringOption,
	Declare,
	Middlewares,
	Options,
} from "seyfert";
import { CONFIG } from "@/config";
import { censorService } from "@/services/censorService";
import { Embeds } from "@/utils/embeds";

const options = {
	palabra: createStringOption({
		description: "La palabra a agregar a la lista de censura",
		required: true,
	}),
};

@Declare({
	name: "addcensorword",
	description: "Agrega una palabra a la lista de censura",
	props: {
		requiredRoles: [CONFIG.ROLES.ADMIN],
	},
})
@Options(options)
@Middlewares(["auth"])
export default class AddCensorWordCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const { palabra } = ctx.options;
		const added = await censorService.addWord(palabra);
		if (added) {
			await ctx.write({
				embeds: [
					Embeds.successEmbed(
						"Palabra agregada",
						`\`${palabra}\` fue agregada a la lista de censura.`,
					),
				],
			});
		} else {
			await ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Palabra ya existente",
						`\`${palabra}\` ya está en la lista de censura.`,
					),
				],
			});
		}
	}
}
