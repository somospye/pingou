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

	jobOfferEmbed(data: {
		title: string;
		description: string;
		requirements: string;
		salary?: string | null;
		contact: string;
		authorName: string;
		authorIcon?: string;
	}): Embed {
		return new Embed()
			.setTitle(`OFERTA: ${data.title}`)
			.setColor("Blue")
			.addFields([
				{ name: "Descripción", value: data.description },
				{ name: "Requisitos", value: data.requirements },
				{
					name: "Salario",
					value: data.salary || "A convenir",
					inline: true,
				},
				{ name: "Contacto", value: data.contact, inline: true },
			])
			.setAuthor({
				name: data.authorName,
				iconUrl: data.authorIcon,
			})
			.setFooter({
				text: "Asegúrate de revisar bien la oferta antes de postularte.",
			})
			.setTimestamp();
	},

	jobVerificationEmbed(data: {
		title: string;
		description: string;
		requirements: string;
		salary?: string | null;
		contact: string;
		authorName: string;
		authorIcon?: string;
		authorId: string;
	}): Embed {
		return new Embed()
			.setTitle("Solicitud de Publicación de Empleo")
			.setColor("Orange")
			.setAuthor({
				name: data.authorName,
				iconUrl: data.authorIcon,
			})
			.addFields([
				{ name: "Título", value: data.title },
				{ name: "Salario", value: data.salary || "No especificado" },
				{ name: "Contacto", value: data.contact },
				{ name: "Descripción", value: data.description.slice(0, 1024) },
				{ name: "Requisitos", value: data.requirements.slice(0, 1024) },
			])
			.setFooter({ text: `ID Usuario: ${data.authorId}` })
			.setTimestamp();
	},

	jobApprovedEmbed(userId: string, points: number, promoted: boolean): Embed {
		return new Embed()
			.setTitle("✅ Oferta Aprobada")
			.setColor("Green")
			.setDescription(
				`La oferta de <@${userId}> ha sido publicada.\nReputación actual: **${points}**${promoted ? "\n¡Usuario promovido a Reclutador Prioritario!" : ""}`,
			)
			.setTimestamp();
	},

	jobRejectedEmbed(userId: string): Embed {
		return new Embed()
			.setTitle("❌ Oferta Rechazada")
			.setColor("Red")
			.setDescription(
				`La oferta de <@${userId}> ha sido rechazada por el staff.`,
			)
			.setTimestamp();
	},

	pingEmbed(latency: number): Embed {
		return new Embed()
			.setTitle(`**LATENCIA DEL BOT**`)
			.setDescription(`La latencia del bot es de ${latency}ms`)
			.setColor("Blue")
			.setTimestamp();
	},

	threadWelcomeEmbed(data: { description: string; botIcon?: string }): Embed {
		return new Embed()
			.setTitle("¡Hola! Soy Pingou, el asistente virtual de PyE")
			.setThumbnail(data.botIcon || "")
			.setDescription(data.description)
			.setColor("Blue")
			.setTimestamp();
	},
};
