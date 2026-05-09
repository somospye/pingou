import {
	ActionRow,
	Button,
	ComponentCommand,
	type ComponentContext,
} from "seyfert";
import { ButtonStyle, MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { pendingRepRepository } from "@/repositories/pendingRepRepository";
import { reputationService } from "@/services/reputationService";
import { Embeds, hasEmbed } from "@/utils/embeds";

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
		if (!process.env["DEV_GUILD_ID"]) {
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

		const guildId = ctx.guildId;
		if (!guildId) return;

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

		const { points, addedRoles } = await reputationService.addRepAndCheckRoles(
			ctx.client,
			{
				guildId: ctx.guildId,
				receiverId: pending.receiverId,
				giverId: ctx.author.id,
			},
		);

		let receiverName = pending.receiverId;
		try {
			const member = await ctx.client.members.fetch(
				ctx.guildId,
				pending.receiverId,
			);
			receiverName = member.username ?? pending.receiverId;
		} catch {}

		// Felicitación pública si subió de rango

		if (addedRoles.length) {
			const roleNames = await Promise.all(
				addedRoles.map((roleId) =>
					ctx.client.roles
						.fetch(guildId, roleId)
						.then((r) => r?.name ?? roleId)
						.catch(() => roleId),
				),
			);

			await ctx.client.messages.write(pending.originalChannelId, {
				embeds: [
					Embeds.repRoleUpEmbed({
						userId: pending.receiverId,
						roleNames,
						points,
					}),
				],
			});
		}

		await reputationService
			.sendLogRep(ctx.client, {
				giverId: ctx.author.id,
				giverName: ctx.author.username,
				newRoles: addedRoles,
				points,
				receiverId: pending.receiverId,
				receiverName,
			})
			.catch(console.error);

		const remaining = await pendingRepRepository.findByMessageId(notifMsgId);
		const embeds = ctx.interaction.message.embeds;

		// Marcar en el embed al ayudante que recibió rep
		const existingEmbed = (hasEmbed(embeds) ? embeds[0] : {}) as RawEmbed;
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
