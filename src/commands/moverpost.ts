import {
	ActionRow,
	Button,
	Command,
	type CommandContext,
	createChannelOption,
	createStringOption,
	Declare,
	Options,
} from "seyfert";
import { ButtonStyle, ChannelType, MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { movePostService } from "@/services/movePostService";
import { Embeds } from "@/utils/embeds";

const options = {
	foro: createChannelOption({
		description: "Foro al que se moverá el post",
		required: true,
		channel_types: [ChannelType.GuildForum],
	}),
	motivo: createStringOption({
		description: "Motivo del traslado",
		required: true,
		max_length: 512,
	}),
};

const trustedRoles = [
	CONFIG.ROLES.ADMIN,
	CONFIG.ROLES.MODERATOR,
	CONFIG.ROLES.HELPER,
	...CONFIG.REP_TIERS.filter(
		(tier) => tier.minPoints >= CONFIG.POST_MOVE.TRUST_MIN_REP_POINTS,
	).map((tier) => tier.roleId),
];

@Declare({
	name: "moverpost",
	description: "Mueve este post a otro foro",
})
@Options(options)
export default class MovePostCommand extends Command {
	override async run(ctx: CommandContext<typeof options>) {
		const { foro, motivo } = ctx.options;

		const thread = await ctx.client.channels.fetch(ctx.channelId);
		if (!thread.isThread()) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Error",
						"Este comando solo puede usarse dentro de un post de foro.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		const parent = await ctx.client.channels.fetch(thread.parentId);
		if (!parent.isForum()) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Error",
						"Este comando solo puede usarse dentro de un post de foro.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		if (foro.id === parent.id) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Error",
						"El post ya está en ese foro. Elige un foro distinto.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		if (thread.ownerId === ctx.author.id) {
			await ctx.deferReply(true);

			const moved = await movePostService
				.executeMove(ctx.client, {
					threadId: thread.id,
					threadName: thread.name,
					sourceForumId: parent.id,
					targetForumId: foro.id,
					reason: motivo,
					movedById: ctx.author.id,
				})
				.catch((err) => {
					console.error("Failed to move post (owner path):", err);
					return null;
				});

			if (!moved) {
				return ctx.editResponse({
					embeds: [
						Embeds.errorEmbed(
							"Error",
							"No se pudo mover el post. Inténtalo de nuevo más tarde.",
						),
					],
				});
			}

			// El hilo original ya no existe, la respuesta ephemeral puede fallar
			return ctx
				.editResponse({
					embeds: [
						Embeds.successEmbed(
							"Post movido",
							`Tu post ahora está en <#${moved.id}>.`,
						),
					],
				})
				.catch(() => {});
		}

		const memberRoles = ctx.member?.roles.keys ?? [];
		if (!trustedRoles.some((role) => role && memberRoles.includes(role))) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Acceso denegado",
						"Solo el autor del post, el staff o miembros con rango Veterano o superior pueden proponer mover un post.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		const existing = await movePostService.getPending(thread.id);
		if (existing) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Votación en curso",
						"Ya hay una votación activa para mover este post.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		await movePostService.createPending({
			threadId: thread.id,
			targetForumId: foro.id,
			reason: motivo,
			initiatorId: ctx.author.id,
		});

		const button = new Button()
			.setCustomId("move-post-vote")
			.setLabel(`Votar a favor (0/${CONFIG.POST_MOVE.REQUIRED_VOTES})`)
			.setStyle(ButtonStyle.Primary);

		return ctx.write({
			embeds: [
				Embeds.postMoveVoteEmbed({
					targetForumId: foro.id,
					reason: motivo,
					initiatorId: ctx.author.id,
					votes: 0,
					requiredVotes: CONFIG.POST_MOVE.REQUIRED_VOTES,
				}),
			],
			components: [new ActionRow<Button>().setComponents([button])],
		});
	}
}
