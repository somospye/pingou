import type { GenerateContentResponseUsageMetadata } from "@google/genai";
import { type CommandContext, Embed } from "seyfert";

export const Embeds = {
	successEmbed(title: string, description?: string): Embed {
		return new Embed()
			.setTitle(title)
			.setDescription(description)
			.setColor("Green");
	},
	errorEmbed(title: string, description?: string): Embed {
		return new Embed()
			.setTitle(title)
			.setDescription(description)
			.setColor("Red");
	},

	noPermissionsEmbed(): Embed {
		return new Embed()
			.setColor("Red")
			.setTitle("🚫 Acceso Denegado")
			.setDescription("No tienes permiso para usar este comando.");
	},

	suggestionEmbed(ctx: CommandContext, suggestion: string): Embed {
		return new Embed()
			.setTitle(`**Nueva sugerencia!**`)
			.setDescription(`${suggestion}`)
			.setColor("Blurple")
			.setFooter({
				text: `Puedes votar a favor o en contra de esta sugerencia  •  ${new Date().toLocaleString()}`,
			})
			.setAuthor({
				name: `${ctx.author.username}`,
				iconUrl: ctx.author.avatarURL(),
			});
	},

	aiReplyEmbed(
		reply: string,
		usage?: GenerateContentResponseUsageMetadata,
	): Embed {
		const input = usage?.promptTokenCount ?? 0;
		const output = (usage?.totalTokenCount ?? 0) - input;

		const footerText = usage
			? `✨ Respuesta generada por IA | I: ${input} tokens | O: ${output} tokens`
			: "✨ Respuesta generada por IA";
		return new Embed().setDescription(reply).setColor("Blue").setFooter({
			text: footerText,
		});
	},
};
