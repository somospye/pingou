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
import { Embeds } from "@/utils/embeds";

const options = {
	sugerencia: createStringOption({
		description: "Escribe aqui el contenido de tu sugerencia",
		required: true,
		min_length: 16,
	}),
};

@Declare({
	name: "sugerir",
	description: "Haz una sugerencia al servidor",
	props: {
		cooldown: 3600,
		cooldownKey: "suggest",
	},
})
@Options(options)
@Middlewares(["cooldown"])
export default class SuggestCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const { sugerencia } = ctx.options;

		await ctx.deferReply(true);

		const suggestion = await ctx.client.messages.write(
			CONFIG.CHANNELS.SUGGESTIONS,
			{
				embeds: [Embeds.suggestionEmbed(ctx, sugerencia)],
			},
		);

		await suggestion.react("✅");
		await suggestion.react("❌");

		await ctx.client.messages.thread(suggestion.channelId, suggestion.id, {
			name: `Sugerencia de ${ctx.author.username}`,
		});

		await ctx.editOrReply({
			content:
				"Tu sugerencia se ha enviado con exito." +
				`\n\n` +
				`Puedes verla ahora en: https://discord.com/channels/${ctx.guildId}/${CONFIG.CHANNELS.SUGGESTIONS}/${suggestion.id}`,
			flags: MessageFlags.Ephemeral,
		});
	}
}
