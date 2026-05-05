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
	replyModerationError,
	validateModerationLimit,
	validateModerationTarget,
} from "@/utils/moderation";

const options = {
	usuario: createUserOption({
		description: "El usuario a expulsar",
		required: true,
	}),
	razon: createStringOption({
		description: "Razón de la expulsión",
		required: true,
		min_length: 3,
	}),
};

@Declare({
	name: "kick",
	description: "Expulsa a un usuario del servidor",
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
export default class KickCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const { usuario, razon } = ctx.options;
		const guildId = ctx.guildId;

		if (!guildId) return;

		await ctx.deferReply(true);

		if (!(await validateModerationLimit(ctx, "kick"))) return;

		const targetMember = await fetchTargetMember(ctx, guildId, usuario.id);
		if (
			!(await validateModerationTarget(ctx, {
				targetUserId: usuario.id,
				targetMember,
				requireMember: true,
				selfActionMessage: "No puedes expulsarte a ti mismo.",
			}))
		) {
			return;
		}

		try {
			await ctx.client.members.kick(guildId, usuario.id, razon);
		} catch {
			await replyModerationError(
				ctx,
				"No se pudo expulsar al usuario. Verifica que el bot tenga permisos suficientes.",
			);
			return;
		}

		const action = await moderationService.logAction({
			type: "kick",
			targetUserId: usuario.id,
			moderatorId: ctx.author.id,
			guildId,
			reason: razon,
		});

		if (!action) return;

		const displayTarget = buildDisplayUser(usuario);
		await moderationService.sendAuditLog(ctx.client, {
			caseId: action.id,
			type: "kick",
			targetUserId: displayTarget.id,
			targetTag: displayTarget.tag,
			moderatorId: ctx.author.id,
			moderatorTag: ctx.author.username,
			reason: razon,
			targetAvatar: displayTarget.avatar,
		});

		await ctx.editOrReply({
			embeds: [
				Embeds.successEmbed(
					"Usuario Expulsado",
					`**${usuario.username}** expulsado.\n**Caso:** #${action.id}`,
				),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
}
