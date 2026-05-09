import {
	Command,
	type CommandContext,
	createStringOption,
	createUserOption,
	Declare,
	Middlewares,
	Options,
} from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { moderationService } from "@/services/moderationService";
import { formatDuration, parseDurationToSeconds } from "@/utils/duration";
import { Embeds } from "@/utils/embeds";
import {
	buildDisplayUser,
	fetchTargetMember,
	notifyWithFallback,
	replyModerationError,
	validateModerationLimit,
	validateModerationTarget,
} from "../../utils/moderation";

const options = {
	usuario: createUserOption({
		description: "El usuario a silenciar",
		required: true,
	}),
	tipo: createStringOption({
		description: "Tipo de mute",
		required: true,
		choices: [
			{ name: "Chat (texto)", value: "chat" },
			{ name: "Voz", value: "voice" },
		] as const,
	}),
	duracion: createStringOption({
		description: "Duración (ej: 1s, 1m, 1h, 1d, 1mo, 1y)",
		required: true,
	}),
	razon: createStringOption({
		description: "Razón del mute",
		required: true,
		min_length: 3,
	}),
};

@Declare({
	name: "mute",
	description: "Silencia a un usuario (chat o voz)",
	props: {
		requiredRoles: [
			CONFIG.ROLES.ADMIN,
			CONFIG.ROLES.MODERATOR,
			CONFIG.ROLES.HELPER,
		],
	},
})
@Options(options)
@Middlewares(["auth"])
export default class MuteCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const { usuario, tipo, duracion, razon } = ctx.options;
		const guildId = ctx.guildId;
		if (!guildId) return;

		if (usuario.bot) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Error",
						"No podés realizar esta acción sobre un bot.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		const durationSeconds = parseDurationToSeconds(duracion);
		if (durationSeconds === null) {
			return ctx.editOrReply({
				embeds: [
					Embeds.errorEmbed(
						"Formato Inválido",
						"La duración debe ser un número seguido de una unidad (s, m, h, d, w, mo, y). Ej: 1h, 30m, 1d.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		await ctx.deferReply(true);

		if (!(await validateModerationLimit(ctx, "mute"))) return;

		const targetMember = await fetchTargetMember(ctx, guildId, usuario.id);
		if (
			!(await validateModerationTarget(ctx, {
				targetUserId: usuario.id,
				targetMember,
				requireMember: true,
				selfActionMessage: "No puedes silenciarte a ti mismo.",
			}))
		) {
			return;
		}

		try {
			if (tipo === "chat") {
				await ctx.client.members.timeout(
					guildId,
					usuario.id,
					durationSeconds,
					razon,
				);
			} else {
				await ctx.client.members.edit(
					guildId,
					usuario.id,
					{ mute: true },
					razon,
				);
				setTimeout(async () => {
					await ctx.client.members
						.edit(guildId, usuario.id, { mute: false }, "Mute expirado")
						.catch(() => {});
				}, durationSeconds * 1000);
			}
		} catch {
			await replyModerationError(ctx, "Faltan permisos.");
			return;
		}

		const muteTypeLabel = tipo === "chat" ? "Chat" : "Voz";

		const action = await moderationService.logAction({
			type: "mute",
			targetUserId: usuario.id,
			moderatorId: ctx.author.id,
			guildId,
			reason: razon,
			duration: durationSeconds,
			extra: `Tipo: ${muteTypeLabel}`,
		});

		if (!action) return;

		const typeLabel = tipo === "chat" ? "Chat" : "Voz";
		const durStr = formatDuration(durationSeconds);
		const content = `Has sido silenciado (${typeLabel}) por ${durStr}.\nRazon: ${razon}`;

		await notifyWithFallback(ctx.client, {
			userId: usuario.id,
			dmPayload: { content },
			fallbackPayload: {
				content: `<@${usuario.id}> Has sido silenciado (${typeLabel}) por ${durStr}. (MDs cerrados)`,
			},
			fallbackChannelId: CONFIG.CHANNELS.CHAT_GENERAL,
		});

		const displayTarget = buildDisplayUser(usuario);
		await moderationService.sendAuditLog(ctx.client, {
			caseId: action.id,
			type: "mute",
			targetUserId: displayTarget.id,
			targetTag: displayTarget.tag,
			moderatorId: ctx.author.id,
			moderatorTag: ctx.author.username,
			reason: razon,
			duration: durationSeconds,
			extra: `Tipo: ${tipo === "chat" ? "Chat" : "Voz"}`,
			targetAvatar: displayTarget.avatar,
		});

		await ctx.editOrReply({
			embeds: [
				Embeds.successEmbed(
					"Usuario Silenciado",
					`**${displayTarget.tag}** silenciado (${typeLabel}) por ${durStr}.\nCaso: #${action.id}`,
				),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
}
