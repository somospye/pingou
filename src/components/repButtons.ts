import {
	ActionRow,
	Button,
	ComponentCommand,
	type ComponentContext,
} from "seyfert";
import { ButtonStyle, MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "../config/config";
import { pendingRepRepository } from "../repositories/pendingRepRepository";
import { reputationService } from "../services/reputationService";
import { Embeds } from "../utils/embeds";

type RawEmbed = {
	fields?: Array<{ name: string; value: string; inline?: boolean }>;
	[key: string]: unknown;
};

export default class RepButtons extends ComponentCommand {
	override componentType = "Button" as const;

	override filter(ctx: ComponentContext<typeof this.componentType>) {
		return (
			ctx.customId.startsWith("rep-approve-") ||
			ctx.customId === "rep-reject-all"
		);
	}

	override async run(ctx: ComponentContext<typeof this.componentType>) {
		const userRoles = ctx.member?.roles.keys ?? [];
		const canReview = [
			CONFIG.ROLES.ADMIN,
			CONFIG.ROLES.MODERATOR,
			CONFIG.ROLES.HELPER,
		].some((role) => role && userRoles.includes(role));

		if (!canReview) {
			return ctx.write({
				embeds: [Embeds.noPermissionsEmbed()],
				flags: MessageFlags.Ephemeral,
			});
		}

		if (ctx.customId.startsWith("rep-approve-")) {
			return this.handleApprove(ctx);
		}
		if (ctx.customId === "rep-reject-all") {
			return this.handleReject(ctx);
		}
	}

	private async handleApprove(
		ctx: ComponentContext<typeof this.componentType>,
	) {
		const notifMsgId = ctx.interaction.message.id;
		const index = ctx.customId.replace("rep-approve-", "");
		const pendingId = `${notifMsgId}-${index}`;

		await ctx.deferUpdate();

		const pending = await pendingRepRepository.findById(pendingId);
		if (!pending) {
			return ctx.editResponse({
				content: "Este punto de rep ya fue procesado.",
				embeds: [],
				components: [],
			});
		}

		await pendingRepRepository.deleteById(pendingId);

		const { points, prevPoints, newRoles } =
			await reputationService.addRepAndCheckRoles(
				ctx.client,
				ctx.guildId ?? "",
				pending.receiverId,
				ctx.author.id,
			);

		let receiverName = pending.receiverId;
		try {
			const member = await ctx.client.members.fetch(
				ctx.guildId ?? "",
				pending.receiverId,
			);
			receiverName = member?.user?.username ?? pending.receiverId;
		} catch {}

		// Log en canal de puntos
		if (CONFIG.CHANNELS.REP_LOG) {
			const logContent =
				`**${ctx.author.username}** le ha dado +1 rep al usuario: \`${receiverName}\`` +
				` (Canal: <#${CONFIG.CHANNELS.REP_NOTIFICATION}>) - (Razón: <#${pending.originalChannelId}>)` +
				`\n> *Puntos anteriores: ${prevPoints}. Puntos actuales: ${points}*`;
			ctx.client.messages
				.write(CONFIG.CHANNELS.REP_LOG, { content: logContent })
				.catch(() => {});
		}

		const remaining = await pendingRepRepository.findByMessageId(notifMsgId);

		// Marcar en el embed al ayudante que recibió rep
		const existingEmbed = (ctx.interaction.message.embeds?.[0] ??
			{}) as RawEmbed;
		const fields = (existingEmbed.fields ?? []).map((f) => {
			if (f.name !== "POSIBLES AYUDANTES") return f;
			const lines = f.value.split("\n");
			const btnIdx = Number(index);
			if (lines[btnIdx] !== undefined) {
				lines[btnIdx] =
					`~~${lines[btnIdx]}~~ ✅ Rep dado por <@${ctx.author.id}>`;
			}
			return { ...f, value: lines.join("\n") };
		});
		const updatedEmbed = { ...existingEmbed, fields };

		// Reconstruir botones: solo los que quedan pendientes + Eliminar siempre
		const remainingButtons = remaining
			.sort((a, b) => a.id.localeCompare(b.id))
			.map((r) => {
				const idx = r.id.replace(`${notifMsgId}-`, "");
				return new Button()
					.setCustomId(`rep-approve-${idx}`)
					.setLabel(`${Number(idx) + 1}`)
					.setStyle(ButtonStyle.Primary);
			});

		const row = new ActionRow<Button>().setComponents([
			...remainingButtons,
			new Button()
				.setCustomId("rep-reject-all")
				.setLabel("Eliminar")
				.setStyle(ButtonStyle.Secondary),
		]);

		await ctx.editResponse({
			embeds: [updatedEmbed],
			components: [row],
		});
	}

	private async handleReject(ctx: ComponentContext<typeof this.componentType>) {
		const notifMsgId = ctx.interaction.message.id;

		await ctx.deferUpdate();

		await pendingRepRepository.deleteByMessageId(notifMsgId);

		try {
			await ctx.interaction.message.delete();
		} catch {
			await ctx.editResponse({
				content: "*(eliminado)*",
				embeds: [],
				components: [],
			});
		}
	}
}
