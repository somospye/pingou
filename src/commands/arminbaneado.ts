import { Command, type CommandContext, Declare } from "seyfert";

@Declare({
	name: "arminbaneado",
	description: "Manda el link de arminbaneado.com",
})
export default class ArminbaneadoCommand extends Command {
	override async run(ctx: CommandContext) {
		await ctx.write({ content: "https://arminbaneado.com" });
	}
}
