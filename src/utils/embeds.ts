import type { GenerateContentResponseUsageMetadata } from "@google/genai";
import { type CommandContext, Embed, type InMessageEmbed } from "seyfert";
import { CONFIG } from "@/config";
import type { CreateRepLogI } from "@/services/reputationService";
import { formatDurationForModEmbed } from "./duration";
import type { SystemStats } from "./system";

export function hasEmbed(
	embeds: InMessageEmbed[],
): embeds is [InMessageEmbed, ...InMessageEmbed[]] {
	return embeds.length > 0;
}

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

	forumThreadEmbed(data: {
		title: string;
		threadId: string;
		ownerId: string;
		guildId: string;
		forumName: string;
	}): Embed {
		return new Embed()
			.setTitle(`📝 Nuevo hilo en el foro ${data.forumName}`)
			.setDescription(`**${data.title}**\n<@${data.ownerId}> creó una consulta`)
			.setURL(`https://discord.com/channels/${data.guildId}/${data.threadId}`)
			.setColor("Green")
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

	memberJoinEmbed(data: {
		userId: string;
		username: string;
		avatarUrl: string;
		inviteCode: string | null;
		inviterId: string | null;
		inviteUses: number | null;
		inviteMaxUses: number | null;
		inviteMaxAge: number | null;
		inviteCreatedAt: string | null;
		inviterStats: { totalInvites: number; currentMembers: number } | null;
	}): Embed {
		const inviteText =
			data.inviterId && data.inviteCode
				? `<@${data.inviterId}> (\`${data.inviteCode}\`)`
				: data.inviteCode
					? `\`${data.inviteCode}\``
					: "Desconocida";

		const usosText =
			data.inviteUses !== null
				? `${data.inviteUses} / ${data.inviteMaxUses === 0 ? "∞" : data.inviteMaxUses}`
				: "—";

		let duracionText = "—";
		if (data.inviteMaxAge !== null) {
			if (data.inviteMaxAge === 0) {
				duracionText = "Permanente";
			} else if (data.inviteCreatedAt) {
				const expiresAt =
					new Date(data.inviteCreatedAt).getTime() + data.inviteMaxAge * 1000;
				duracionText = `<t:${Math.floor(expiresAt / 1000)}:R>`;
			}
		}

		const fields = [
			{ name: "Invitado por", value: inviteText, inline: true },
			{ name: "Usos", value: usosText, inline: true },
			{ name: "Invite vence", value: duracionText, inline: true },
		];

		if (data.inviterStats !== null) {
			fields.push({
				name: "Personas invitadas",
				value: `**${data.inviterStats.totalInvites}** en total • **${data.inviterStats.currentMembers}** en el servidor`,
				inline: false,
			});
		}

		return new Embed()
			.setAuthor({ name: data.username, iconUrl: data.avatarUrl })
			.setDescription(`<@${data.userId}> se unió al servidor.`)
			.setColor("Blue")
			.addFields(fields)
			.setTimestamp();
	},

	invitesEmbed(data: {
		user: { id: string; username: string };
		dbInvites: Array<{ code: string; uses: number }>;
		joins: Array<{ inviteCode: string; userId: string }>;
	}): Embed {
		const joinsByCode = new Map<string, string[]>();
		for (const join of data.joins) {
			const arr = joinsByCode.get(join.inviteCode) ?? [];
			arr.push(join.userId);
			joinsByCode.set(join.inviteCode, arr);
		}

		const lines: string[] = [];

		for (const invite of data.dbInvites.slice(0, 12)) {
			const joiners = joinsByCode.get(invite.code) ?? [];
			const joinText =
				joiners.length > 0
					? joiners
							.slice(0, 5)
							.map((id) => `<@${id}>`)
							.join(", ") +
						(joiners.length > 5 ? ` y ${joiners.length - 5} más` : "")
					: "nadie aún";
			lines.push(
				`**\`${invite.code}\`** — ${invite.uses} uso(s)\n↳ ${joinText}`,
			);
		}

		const totalJoins = data.joins.length;
		const totalInvites = data.dbInvites.length;

		return new Embed()
			.setTitle(`Invites de @${data.user.username}`)
			.setDescription(
				lines.length > 0
					? lines.join("\n\n")
					: "Este usuario no tiene invitaciones registradas.",
			)
			.setColor("Blue")
			.setFooter({
				text: `${totalInvites} invite(s) • ${totalJoins} join(s) registrado(s)`,
			})
			.setTimestamp();
	},

	repNotificationEmbed(data: {
		giverId: string;
		giverName: string;
		receivers: Array<{ id: string; name: string }>;
		messageUrl: string;
		channelId: string;
		thanksContent: string;
		referencedContent: string | null;
	}): Embed {
		const truncate = (s: string, n: number) =>
			s.length > n ? `${s.slice(0, n)}...` : s;

		const firstReceiver = data.receivers[0];
		const mensajeLines =
			data.referencedContent && firstReceiver
				? `**@${firstReceiver.name}:** ${truncate(data.referencedContent, 200)}\n**@${data.giverName} respondió:** ${truncate(data.thanksContent, 200)}`
				: `**@${data.giverName}:** ${truncate(data.thanksContent, 300)}`;

		const ayudantesValue = data.receivers
			.map((r, i) => `${i + 1}. (${r.id}) - <@${r.id}>`)
			.join("\n");

		return new Embed()
			.setTitle("Se ha encontrado una nueva ayuda!")
			.setColor("Blue")
			.addFields([
				{ name: "CANAL", value: `<#${data.channelId}>`, inline: true },
				{
					name: "MIEMBRO AYUDADO",
					value: `<@${data.giverId}> (${data.giverId})`,
					inline: true,
				},
				{
					name: "MENSAJE DE AGRADECIMIENTO",
					value: `[Ver mensaje](${data.messageUrl})\n${mensajeLines}`,
					inline: false,
				},
				{
					name: "POSIBLES AYUDANTES",
					value: ayudantesValue,
					inline: false,
				},
			])
			.setTimestamp();
	},

	repStatsEmbed(data: {
		userId: string;
		username: string;
		avatarUrl?: string;
		points: number;
		currentTier: { minPoints: number; roleId: string } | null;
		nextTier: { minPoints: number; roleId: string } | null;
	}): Embed {
		const progressText = data.nextTier
			? `${data.points} / ${data.nextTier.minPoints} para <@&${data.nextTier.roleId}>`
			: `${data.points} pts — nivel máximo alcanzado`;

		const tierText = data.currentTier
			? `<@&${data.currentTier.roleId}>`
			: CONFIG.ROLES.NOVATO
				? `<@&${CONFIG.ROLES.NOVATO}>`
				: "*Sin rol de reputación aún*";

		return new Embed()
			.setTitle(`Reputación de ${data.username}`)
			.setColor("Blue")
			.setThumbnail(data.avatarUrl || "")
			.addFields([
				{ name: "Puntos", value: `**${data.points}**`, inline: true },
				{ name: "Rango actual", value: tierText, inline: true },
				{ name: "Progreso", value: progressText, inline: false },
			])
			.setFooter({ text: `ID: ${data.userId}` })
			.setTimestamp();
	},

	repRoleUpEmbed(data: {
		userId: string;
		roleNames: string[];
		points: number;
	}): Embed {
		const rolesText = data.roleNames.join(", ");
		return new Embed()
			.setTitle("¡Subiste de rango!")
			.setColor("Gold")
			.setDescription(
				`<@${data.userId}> alcanzó **${rolesText}** con **${data.points} puntos** de reputación. ¡Felicitaciones!`,
			)
			.setTimestamp();
	},

	repRoleDownEmbed(data: {
		userId: string;
		roleNames: string[];
		points: number;
	}): Embed {
		const rolesText = data.roleNames.join(", ");
		return new Embed()
			.setTitle("Bajaste de rango")
			.setColor("Red")
			.setDescription(
				`<@${data.userId}> bajó de **${rolesText}** y ahora tiene **${data.points} puntos** de reputación.`,
			)
			.setTimestamp();
	},

	repTopEmbed(data: {
		users: Array<{ userId: string; points: number }>;
	}): Embed {
		const lines =
			data.users.length > 0
				? data.users.map((u, i) => {
						const medal =
							i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
						return `${medal} <@${u.userId}> — **${u.points}** pts`;
					})
				: ["*Sin datos.*"];

		return new Embed()
			.setTitle("🏆 Top Reputación")
			.setDescription(lines.join("\n"))
			.setColor(0xf1c40f)
			.setTimestamp();
	},

	repLogEmbed(data: CreateRepLogI): Embed {
		const roleText =
			data.newRoles.length > 0
				? `\nNuevo rol: ${data.newRoles.map((r) => `<@&${r}>`).join(", ")}`
				: "";
		return new Embed()
			.setTitle("Punto de reputación otorgado")
			.setColor("Green")
			.addFields([
				{
					name: "Ayudante",
					value: `<@${data.receiverId}> (${data.receiverName})`,
					inline: true,
				},
				{ name: "Puntos totales", value: `**${data.points}**`, inline: true },
				{
					name: "Otorgado por",
					value: `<@${data.giverId}> (${data.giverName})`,
					inline: false,
				},
			])
			.setDescription(roleText || undefined)
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

	systemStatsEmbed(
		stats: SystemStats,
		formatBytes: (bytes: number) => string,
		formatUptime: (seconds: number) => string,
	): Embed {
		const cpuField = {
			name: "CPU",
			value: `${stats.cpu.brand} (${stats.cpu.cores}C/${stats.cpu.physicalCores}P)\nUso: ${stats.cpu.load.toFixed(2)}% | ${stats.cpu.speed}GHz`,
			inline: false,
		};

		const memField = {
			name: "Memoria RAM",
			value: `Total: ${formatBytes(stats.mem.total)}\nUsado: ${formatBytes(stats.mem.used)} (${stats.mem.usedPercent.toFixed(2)}%)\nLibre: ${formatBytes(stats.mem.free)}`,
			inline: false,
		};

		const osField = {
			name: "Sistema",
			value: `${stats.os.distro} ${stats.os.release}\nUptime: ${formatUptime(stats.os.uptime)}`,
			inline: false,
		};

		const diskFields = stats.disk.slice(0, 3).map((d) => ({
			name: `Disco: ${d.mount}`,
			value: `Total: ${formatBytes(d.size)}\nUsado: ${formatBytes(d.used)} (${d.use}%)\nLibre: ${formatBytes(d.available)}\nTipo: ${d.type}`,
			inline: true,
		}));

		return new Embed()
			.setTitle("📊 Estadísticas del Sistema")
			.addFields([cpuField, memField, osField, ...diskFields])
			.setColor("Blue")
			.setTimestamp();
	},

	topRepEmbed(data: {
		users: Array<{ userId: string; points: number }>;
		tipo: string;
		period: string;
	}): Embed {
		const periodLabels: Record<string, string> = {
			weekly: "última semana",
			monthly: "último mes",
			all: "todo el tiempo",
		};

		const tipoLabels: Record<string, string> = {
			rep: "Reputación General",
			empleos: "Reputación Empleos",
		};

		const lines =
			data.users.length > 0
				? data.users.map((u, i) => {
						const medal =
							i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
						return `${medal} <@${u.userId}> — **${u.points}** pt${u.points === 1 ? "o" : "s"}`;
					})
				: ["*Sin datos.*"];

		return new Embed()
			.setTitle(
				`Top ${tipoLabels[data.tipo] ?? data.tipo} — ${periodLabels[data.period] ?? data.period}`,
			)
			.setDescription(lines.join("\n"))
			.setColor(0xf1c40f)
			.setTimestamp();
	},

	topNegativeEmbed(data: {
		users: Array<{ userId: string; points: number }>;
		period: string;
	}): Embed {
		const periodLabels: Record<string, string> = {
			weekly: "última semana",
			monthly: "último mes",
			all: "todo el tiempo",
		};

		const lines =
			data.users.length > 0
				? data.users.map((u, i) => {
						const medal =
							i === 0 ? "😈" : i === 1 ? "👿" : i === 2 ? "💀" : `${i + 1}.`;
						return `${medal} <@${u.userId}> — **${u.points}** pt${u.points === -1 ? "o" : "s"}`;
					})
				: ["*Sin datos.*"];

		return new Embed()
			.setTitle(
				`Top Reputación Negativa — ${periodLabels[data.period] ?? data.period}`,
			)
			.setDescription(lines.join("\n"))
			.setColor(0xe74c3c)
			.setTimestamp();
	},
};
