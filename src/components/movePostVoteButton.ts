import {
	ActionRow,
	Button,
	ComponentCommand,
	type ComponentContext,
} from "seyfert";
import { ButtonStyle, MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { type ExecuteMoveI, movePostService } from "@/services/movePostService";
import { Embeds } from "@/utils/embeds";

export default class MovePostVoteButton extends ComponentCommand {
	override componentType = "Button" as const;

	override filter(ctx: ComponentContext<typeof this.componentType>) {
		return ctx.customId === "move-post-vote";
	}

	override async run(ctx: ComponentContext<typeof this.componentType>) {
		const threadId = ctx.channelId;
		const pending = await movePostService.getPending(threadId);

		if (!pending) {
			await ctx.interaction.message.edit({ components: [] }).catch(() => {});
			return ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Votación expirada",
						"Esta votación ya no está activa.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		const thread = await ctx.client.channels.fetch(threadId).catch(() => null);
		if (!thread?.isThread()) {
			return movePostService.deletePending(threadId);
		}

		const moveData: ExecuteMoveI = {
			threadId,
			threadName: thread.name,
			sourceForumId: thread.parentId,
			targetForumId: pending.targetForumId,
			reason: pending.reason,
			movedById: pending.initiatorId,
		};

		// El autor del post aprueba el traslado con un solo voto
		if (ctx.author.id === thread.ownerId) {
			return this.executeMove(ctx, moveData);
		}

		if (ctx.author.id === pending.initiatorId) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Voto no permitido",
						"Iniciaste esta votación, no puedes votar a tu propia propuesta.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		if (pending.voterIds.includes(ctx.author.id)) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed("Voto duplicado", "Ya votaste en esta propuesta."),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		const updated = await movePostService.addVote(threadId, ctx.author.id);
		if (!updated) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Voto no registrado",
						"No se pudo registrar tu voto. Es posible que la votación ya no esté activa.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		if (updated.voterIds.length >= CONFIG.POST_MOVE.REQUIRED_VOTES) {
			return this.executeMove(ctx, moveData);
		}

		await ctx.deferUpdate();

		const button = new Button()
			.setCustomId("move-post-vote")
			.setLabel(
				`Votar a favor (${updated.voterIds.length}/${CONFIG.POST_MOVE.REQUIRED_VOTES})`,
			)
			.setStyle(ButtonStyle.Primary);

		return ctx.editResponse({
			embeds: [
				Embeds.postMoveVoteEmbed({
					targetForumId: updated.targetForumId,
					reason: updated.reason,
					initiatorId: updated.initiatorId,
					votes: updated.voterIds.length,
					requiredVotes: CONFIG.POST_MOVE.REQUIRED_VOTES,
				}),
			],
			components: [new ActionRow<Button>().setComponents([button])],
		});
	}

	private async executeMove(
		ctx: ComponentContext<typeof this.componentType>,
		data: ExecuteMoveI,
	) {
		await ctx.deferUpdate();

		// Reclama la fila pendiente: si otro click concurrente ya la borró,
		// el traslado ya está en marcha y no debe ejecutarse dos veces
		const claimed = await movePostService.deletePending(data.threadId);
		if (!claimed.length) return;

		const moved = await movePostService
			.executeMove(ctx.client, data)
			.catch((err) => {
				console.error("Failed to move post (vote path):", err);
				return null;
			});

		if (!moved) {
			await ctx
				.followup({
					embeds: [
						Embeds.errorEmbed(
							"Error",
							"No se pudo mover el post. Inténtalo de nuevo más tarde.",
						),
					],
					flags: MessageFlags.Ephemeral,
				})
				.catch(() => {});
		}
	}
}
