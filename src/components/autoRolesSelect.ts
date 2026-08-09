import { ComponentCommand, type ComponentContext } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { Embeds } from "@/utils/embeds";

const CUSTOM_ID_PREFIX = "autoroles:";

export default class AutoRolesSelect extends ComponentCommand {
	override componentType = "StringSelect" as const;

	override filter(ctx: ComponentContext<typeof this.componentType>) {
		return ctx.customId.startsWith(CUSTOM_ID_PREFIX);
	}

	override async run(ctx: ComponentContext<typeof this.componentType>) {
		const { guildId, member } = ctx;
		if (!guildId || !member) return;

		const categoryId = ctx.customId.slice(CUSTOM_ID_PREFIX.length);
		const category = CONFIG.AUTO_ROLES.find((c) => c.id === categoryId);
		if (!category) {
			return ctx.write({
				embeds: [
					Embeds.errorEmbed(
						"Auto-roles",
						"Esta categoría ya no está configurada.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		await ctx.deferReply(true);

		const selected = new Set(ctx.interaction.values);
		const memberRoles = member.roles.keys;

		const added: string[] = [];
		const removed: string[] = [];

		for (const role of category.roles) {
			const hasRole = memberRoles.includes(role.roleId);

			if (selected.has(role.roleId) && !hasRole) {
				const ok = await ctx.client.members
					.addRole(guildId, ctx.author.id, role.roleId)
					.then(() => true)
					.catch((err) => {
						console.error(`Failed to add auto-role ${role.roleId}:`, err);
						return false;
					});
				if (ok) added.push(role.label);
			} else if (!selected.has(role.roleId) && hasRole) {
				const ok = await ctx.client.members
					.removeRole(guildId, ctx.author.id, role.roleId)
					.then(() => true)
					.catch((err) => {
						console.error(`Failed to remove auto-role ${role.roleId}:`, err);
						return false;
					});
				if (ok) removed.push(role.label);
			}
		}

		await ctx.editResponse({
			embeds: [Embeds.autoRolesUpdatedEmbed({ added, removed })],
			flags: MessageFlags.Ephemeral,
		});
	}
}
