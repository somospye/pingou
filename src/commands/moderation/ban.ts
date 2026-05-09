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
} from "../../utils/moderation";

const options = {
	usuario: createUserOption({
		description: "El usuario a banear",
		required: true,
	}),
	razon: createStringOption({
		description: "Razón del baneo",
		required: true,
		min_length: 3,
	}),
};

@Declare({
	name: "ban",
	description: "Banea a un usuario del servidor",
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
export default class BanCommand extends Command {
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

		if (!(await validateModerationLimit(ctx, "ban"))) return;

		const targetMember = await fetchTargetMember(ctx, guildId, usuario.id);
		if (
			!(await validateModerationTarget(ctx, {
				targetUserId: usuario.id,
				targetMember,
				requireMember: false,
				selfActionMessage: "No puedes banearte a ti mismo.",
			}))
		) {
			return;
		}

		try {
			await ctx.client.members.ban(guildId, usuario.id, {}, razon);
		} catch {
			await replyModerationError(
				ctx,
				"No se pudo banear al usuario. Verifica que el bot tenga permisos suficientes.",
			);
			return;
		}

		const action = await moderationService.logAction({
			type: "ban",
			targetUserId: usuario.id,
			moderatorId: ctx.author.id,
			guildId,
			reason: razon,
		});

		if (!action) return;

		const displayTarget = buildDisplayUser(usuario);
		await moderationService.sendAuditLog(ctx.client, {
			caseId: action.id,
			type: "ban",
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
					"Usuario Baneado",
					`**${usuario.username}** baneado.\n**Caso:** #${action.id}`,
				),
			],
			flags: MessageFlags.Ephemeral,
		});
	}
}
