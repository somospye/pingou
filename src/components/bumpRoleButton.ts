import { ComponentCommand, type ComponentContext } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { BUMP_BUTTON_ID, bumpService } from "@/services/bumpService";
import { Embeds } from "@/utils/embeds";

export default class BumpRoleButton extends ComponentCommand {
	override componentType = "Button" as const;

	override filter(ctx: ComponentContext<typeof this.componentType>) {
		return ctx.customId === BUMP_BUTTON_ID;
	}

	override async run(ctx: ComponentContext<typeof this.componentType>) {
		const guildId = ctx.guildId;
		if (!guildId) return;

		await ctx.deferReply(true);

		const roleId = await bumpService.ensureBumpRole(ctx.client);
		if (!roleId) {
			return ctx.editResponse({
				embeds: [
					Embeds.errorEmbed("Bump rol", "No se pudo encontrar el rol de bump."),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		const hasRole = ctx.member?.roles.keys.includes(roleId);

		if (hasRole) {
			await ctx.client.members.removeRole(guildId, ctx.author.id, roleId);
			await ctx.editResponse({
				flags: MessageFlags.Ephemeral,
				embeds: [
					Embeds.successEmbed("", "Ya no te recordaremos de bumpear. :("),
				],
			});
		} else {
			await ctx.client.members.addRole(guildId, ctx.author.id, roleId);
			await ctx.editResponse({
				embeds: [
					Embeds.successEmbed("", "¡Te avisaremos cuando puedas bumpear!"),
				],
				flags: MessageFlags.Ephemeral,
			});
		}
	}
}
