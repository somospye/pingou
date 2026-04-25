import type { GenerateContentResponseUsageMetadata } from "@google/genai";
import { type CommandContext, Embed } from "seyfert";
import { formatDurationForModEmbed } from "./duration";

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
			.setTitle("Acceso Denegado")
			.setDescription("No tienes permisos suficientes.");
	},

	suggestionEmbed(ctx: CommandContext, suggestion: string): Embed {
		return new Embed()
			.setTitle(`Nueva sugerencia`)
			.setDescription(`${suggestion}`)
			.setColor("Blurple")
			.setFooter({
				text: `Vota a favor o en contra  •  ${new Date().toLocaleString()}`,
			})
			.setAuthor({
				name: `${ctx.author.username}`,
				iconUrl: ctx.author.avatarURL(),
			});
	},

	aiReplyEmbeds(
		reply: string,
		usage?: GenerateContentResponseUsageMetadata,
	): Embed[] {
		const chunks = this.chunkText(reply, 4000);
		const input = usage?.promptTokenCount ?? 0;
		const output = (usage?.totalTokenCount ?? 0) - input;

		const footerText = usage
			? `Respuesta IA | I: ${input} | O: ${output}`
			: "Respuesta IA";

		return chunks.map((chunk, i) => {
			const embed = new Embed().setDescription(chunk).setColor("Blue");
			if (i === chunks.length - 1) {
				embed.setFooter({ text: footerText });
			}
			return embed;
		});
	},

	chunkText(text: string, size: number): string[] {
		const chunks: string[] = [];
		for (let i = 0; i < text.length; i += size) {
			chunks.push(text.slice(i, i + size));
		}
		return chunks;
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

	modActionEmbed(data: {
		caseId: number;
		type: string;
		targetUserId: string;
		targetTag: string;
		moderatorId: string;
		moderatorTag: string;
		reason: string;
		duration?: number;
		extra?: string;
		targetAvatar?: string;
	}): Embed {
		const typeLabels: Record<string, { label: string; icon: string }> = {
			ban: { label: "Usuario Baneado", icon: "" },
			kick: { label: "Usuario Expulsado", icon: "" },
			mute: { label: "Usuario Silenciado", icon: "" },
			warn: { label: "Advertencia", icon: "" },
			restrict: { label: "Restricción Aplicada", icon: "" },
		};

		const colorMap: Record<string, number> = {
			ban: 0xe74c3c,
			kick: 0xe67e22,
			mute: 0xf1c40f,
			warn: 0xffa500,
			restrict: 0x9b59b6,
		};

		const info = typeLabels[data.type] || {
			label: data.type,
			icon: "",
		};

		const fields = [
			{
				name: "Usuario",
				value: `${data.targetTag} (${data.targetUserId})`,
				inline: false,
			},
			{ name: "Razón", value: data.reason, inline: false },
			{
				name: "Moderado por",
				value: `${data.moderatorTag} (${data.moderatorId})`,
				inline: false,
			},
		];

		if (data.duration) {
			fields.splice(2, 0, {
				name: "Duración",
				value: formatDurationForModEmbed(data.duration),
				inline: false,
			});
		}

		if (data.extra) {
			fields.splice(-1, 0, {
				name: "Detalles",
				value: data.extra,
				inline: false,
			});
		}

		const embed = new Embed()
			.setTitle(info.label)
			.setColor(colorMap[data.type] ?? 0x95a5a6)
			.addFields(fields)
			.setFooter({ text: `Caso #${data.caseId}` })
			.setTimestamp();

		if (data.targetAvatar) {
			embed.setThumbnail(data.targetAvatar);
		}

		return embed;
	},

	warnDMEmbed(data: {
		guildName: string;
		reason: string;
		caseId: number;
		moderatorTag: string;
	}): Embed {
		return new Embed()
			.setTitle("Has recibido una advertencia")
			.setColor(0xffa500)
			.setDescription(`Has sido advertido en **${data.guildName}**.`)
			.addFields([
				{ name: "Razón", value: data.reason, inline: false },
				{
					name: "Moderador",
					value: data.moderatorTag,
					inline: true,
				},
				{
					name: "Caso",
					value: `#${data.caseId}`,
					inline: true,
				},
			])
			.setFooter({
				text: "Si crees que esto fue un error, contacta al staff.",
			})
			.setTimestamp();
	},

	casesEmbed(data: {
		targetTag: string;
		targetId: string;
		cases: Array<{
			id: number;
			type: string;
			reason: string;
			moderatorId: string;
			createdAt: Date;
		}>;
		page: number;
		totalPages: number;
		totalCases: number;
	}): Embed {
		const caseLines =
			data.cases.length > 0
				? data.cases
						.map((c) => {
							const timestamp = Math.floor(c.createdAt.getTime() / 1000);
							return `**#${c.id}** \`${c.type.toUpperCase()}\` — ${c.reason.slice(0, 60)}\n↳ Mod: <@${c.moderatorId}> • <t:${timestamp}:R>`;
						})
						.join("\n\n")
				: "*Usuario sin casos.*";

		return new Embed()
			.setTitle(`Historial de ${data.targetTag}`)
			.setDescription(caseLines)
			.setColor(0x3498db)
			.setFooter({
				text: `ID: ${data.targetId} • Total: ${data.totalCases} • Página ${data.page} de ${data.totalPages}`,
			})
			.setTimestamp();
	},

	rateLimitEmbed(actionType: string, limit: number): Embed {
		return new Embed()
			.setTitle("Límite alcanzado")
			.setDescription(
				`Has alcanzado tu límite para **${actionType}** (${limit} usos).`,
			)
			.setColor(0xe74c3c)
			.setTimestamp();
	},

	modStatsEmbed(data: {
		period: string;
		stats: Array<{ type: string; total: number }>;
		guildName: string;
	}): Embed {
		const total = data.stats.reduce((sum, s) => sum + s.total, 0);
		const maxTotal = Math.max(...data.stats.map((s) => s.total), 1);
		const barLength = 10;

		const lines =
			data.stats.length > 0
				? data.stats.map((s) => {
						const filled = Math.round((s.total / maxTotal) * barLength);
						const bar = "█".repeat(filled) + "░".repeat(barLength - filled);
						return `**${s.type.toUpperCase()}** \`${bar}\` ${s.total}`;
					})
				: ["*Sin sanciones.*"];

		return new Embed()
			.setTitle(`Estadísticas de Moderación — ${data.period}`)
			.setDescription(lines.join("\n"))
			.setColor(0x5865f2)
			.addFields([
				{
					name: "Total",
					value: `**${total}**`,
					inline: true,
				},
				{
					name: "Servidor",
					value: data.guildName,
					inline: true,
				},
			])
			.setTimestamp();
	},

	voiceUnrestrictDMEmbed(guildName: string): Embed {
		return new Embed()
			.setTitle("¡Ya puedes acceder a los canales de voz!")
			.setColor("Green")
			.setDescription(
				`Han pasado las 6 horas de espera en **${guildName}**. Tu restricción de voz fue levantada, ¡a disfrutar!`,
			)
			.setTimestamp();
	},

	voiceRestrictDMEmbed(guildName: string): Embed {
		return new Embed()
			.setTitle(`¡Bienvenido/a a ${guildName}!`)
			.setColor("Blue")
			.setDescription(
				`Nos alegra tenerte aquí. Te avisamos que por política del servidor, **no podrás acceder a los canales de voz durante las primeras 6 horas** desde que te uniste.\n\nUna vez transcurrido ese tiempo, el acceso se habilitará automáticamente.`,
			)
			.setFooter({ text: "Si tienes alguna duda, contacta al staff." })
			.setTimestamp();
	},

	modTopEmbed(data: {
		period: string;
		moderators: Array<{
			moderatorId: string;
			total: number;
			bans: number;
			kicks: number;
			mutes: number;
			warns: number;
			restricts: number;
		}>;
	}): Embed {
		const lines =
			data.moderators.length > 0
				? data.moderators.map((m, i) => {
						const breakdown = [
							m.bans ? `B:${m.bans}` : null,
							m.kicks ? `K:${m.kicks}` : null,
							m.mutes ? `M:${m.mutes}` : null,
							m.warns ? `W:${m.warns}` : null,
							m.restricts ? `R:${m.restricts}` : null,
						]
							.filter(Boolean)
							.join(" ");
						return `**${i + 1}.** <@${m.moderatorId}> — **${m.total}**\n↳ ${breakdown || "—"}`;
					})
				: ["*Sin datos.*"];

		return new Embed()
			.setTitle(`Top Moderadores — ${data.period}`)
			.setDescription(lines.join("\n\n"))
			.setColor(0xf1c40f)
			.setTimestamp();
	},
};
