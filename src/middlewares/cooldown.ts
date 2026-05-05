import { createMiddleware } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { cooldownService } from "@/services/cooldown";
import { Embeds } from "@/utils/embeds";

export const CooldownMiddleware = createMiddleware<void>(
	async ({ context, next, stop }) => {
		const cooldownAmount = context.command.props.cooldown;

		if (!cooldownAmount) return next();

		const userId = context.author.id;
		const key =
			context.command.props.cooldownKey ||
			("name" in context.command ? context.command.name : "global") ||
			"global";

		const currentCooldown = await cooldownService.getCooldown(userId, key);

		if (currentCooldown) {
			const expiresAt = Math.floor(currentCooldown.expiresAt.getTime() / 1000);
			const remaining = Math.ceil(
				(currentCooldown.expiresAt.getTime() - Date.now()) / 1000,
			);

			await context.write({
				embeds: [
					Embeds.errorEmbed(
						"Cooldown Activo",
						`Este comando tiene un tiempo de espera. Podrás volver a usarlo <t:${expiresAt}:R>.`,
					),
				],
				flags: MessageFlags.Ephemeral,
			});

			return stop(`Cooldown activo - ${key} - ${userId} : ${remaining}s`);
		}

		await cooldownService.setCooldown(userId, key, cooldownAmount);
		return next();
	},
);
