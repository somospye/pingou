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
} from "@/utils/moderation";

const options = {
	usuario: createUserOption({
		description: "El usuario al que aplicar la restricción",
		required: true,
	}),
	tipo: createStringOption({
		description: "Tipo de restricción",
		required: true,
		choices: [
			{ name: "Voz", value: "VOZ" },
			{ name: "Foros", value: "FOROS" },
			{ name: "Empleos", value: "EMPLEOS" },
		] as const,
	}),
	duracion: createStringOption({
		description: "Duración (ej: 1s, 1m, 1h, 0 para permanente)",
		required: true,
	}),
	razon: createStringOption({
		description: "Razón de la restricción",
		required: true,
		min_length: 3,
	}),
};

@Declare({
	name: "restrict",
	description: "Aplica un rol de restricción específico",
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
export default class RestrictCommand extends Command {
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

		let durationSeconds: number | undefined;
		if (duracion !== "0") {
			const parsed = parseDurationToSeconds(duracion);
			if (parsed === null) {
				return ctx.editOrReply({
					embeds: [
						Embeds.errorEmbed(
							"Formato Inválido",
							"La duración debe ser un número seguido de una unidad (s, m, h, d, w, mo, y) o 0 para permanente.",
						),
					],
					flags: MessageFlags.Ephemeral,
				});
			}
			durationSeconds = parsed;
		}

		await ctx.deferReply(true);

		if (!(await validateModerationLimit(ctx, "restrict"))) return;

		const targetMember = await fetchTargetMember(ctx, guildId, usuario.id);
		if (
			!(await validateModerationTarget(ctx, {
				targetUserId: usuario.id,
				targetMember,
				requireMember: true,
				selfActionMessage: "No puedes restringirte a ti mismo.",
			}))
		) {
			return;
		}

		const roleId = CONFIG.RESTRICTIONS[tipo];
		if (!roleId) {
			await replyModerationError(ctx, "Rol no configurado.");
			return;
		}

		try {
			await ctx.client.members.addRole(guildId, usuario.id, roleId);
		} catch {
			await replyModerationError(ctx, "Faltan permisos.");
			return;
		}

		if (durationSeconds && durationSeconds > 0) {
			setTimeout(async () => {
				await ctx.client.members
					.removeRole(guildId, usuario.id, roleId)
					.catch(() => {});
			}, durationSeconds * 1000);
		}

		const action = await moderationService.logAction({
			type: "restrict",
			targetUserId: usuario.id,
			moderatorId: ctx.author.id,
			guildId,
			reason: razon,
			duration: durationSeconds,
			extra: `Restricción: ${tipo}`,
		});

		if (!action) return;

		const displayTarget = buildDisplayUser(usuario);
		const durationLabel =
			durationSeconds && durationSeconds > 0
				? formatDuration(durationSeconds)
				: "Permanente";
		const dmDurationLabel =
			durationSeconds && durationSeconds > 0
				? ` por ${durationLabel}`
				: " permanente";

		await notifyWithFallback(ctx.client, {
			userId: usuario.id,
			dmPayload: {
				content: `Se te ha aplicado una restricción de ${tipo}${dmDurationLabel}.\nRazon: ${razon}`,
			},
			fallbackPayload: {
				content: `<@${usuario.id}> Restricción de ${tipo}${dmDurationLabel}. (MDs cerrados)`,
			},
			fallbackChannelId: CONFIG.CHANNELS.CHAT_GENERAL,
		});

		await moderationService.sendAuditLog(ctx.client, {
			caseId: action.id,
			type: "restrict",
			targetUserId: displayTarget.id,
			targetTag: displayTarget.tag,
			moderatorId: ctx.author.id,
			moderatorTag: ctx.author.username,
			reason: razon,
			extra: `Tipo: ${tipo} (${durationLabel})`,
			targetAvatar: displayTarget.avatar,
		});

		await ctx.editOrReply({
			embeds: [
				Embeds.successEmbed(
					"Restricción Aplicada",
					`**${displayTarget.tag}** con restricción de **${tipo}** por ${durationLabel}.\nCaso: #${action.id}`,
				),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
}
