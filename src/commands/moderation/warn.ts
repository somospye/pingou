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
import { Embeds } from "@/utils/embeds";
import {
	buildDisplayUser,
	fetchTargetMember,
	notifyWithFallback,
	validateModerationLimit,
	validateModerationTarget,
} from "@/utils/moderation";

const options = {
	usuario: createUserOption({
		description: "El usuario a advertir",
		required: true,
	}),
	razon: createStringOption({
		description: "Razón de la advertencia",
		required: true,
		min_length: 3,
	}),
};

@Declare({
	name: "warn",
	description: "Envía una advertencia a un usuario",
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
export default class WarnCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const { usuario, razon } = ctx.options;
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

		await ctx.deferReply(true);

		if (!(await validateModerationLimit(ctx, "warn"))) return;

		const targetMember = await fetchTargetMember(ctx, guildId, usuario.id);
		if (
			!(await validateModerationTarget(ctx, {
				targetUserId: usuario.id,
				targetMember,
				requireMember: false,
				selfActionMessage: "No puedes advertirte a ti mismo.",
			}))
		) {
			return;
		}

		const action = await moderationService.logAction({
			type: "warn",
			targetUserId: usuario.id,
			moderatorId: ctx.author.id,
			guildId,
			reason: razon,
		});

		if (!action) return;

		const guild = await ctx.client.guilds.fetch(guildId).catch(() => null);
		await notifyWithFallback(ctx.client, {
			userId: usuario.id,
			dmPayload: {
				embeds: [
					Embeds.warnDMEmbed({
						guildName: guild?.name || "el servidor",
						reason: razon,
						caseId: action.id,
						moderatorTag: ctx.author.username,
					}),
				],
			},
			fallbackPayload: {
				content: `<@${usuario.id}> Advertencia recibida. (MDs cerrados)\nRazon: ${razon}`,
			},
			fallbackChannelId: CONFIG.CHANNELS.CHAT_GENERAL,
		});

		const displayTarget = buildDisplayUser(usuario);
		await moderationService.sendAuditLog(ctx.client, {
			caseId: action.id,
			type: "warn",
			targetUserId: displayTarget.id,
			targetTag: displayTarget.tag,
			moderatorId: ctx.author.id,
			moderatorTag: ctx.author.username,
			reason: razon,
			targetAvatar: displayTarget.avatar,
		});

		const warns = await moderationService.getUserWarns(usuario.id, guildId);

		await ctx.editOrReply({
			embeds: [
				Embeds.successEmbed(
					"Advertencia Registrada",
					`**${usuario.username}** advertido.\nCaso: #${action.id}\nWarns activos: ${warns.length}`,
				),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
}
