import { createMiddleware } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { Embeds } from "@/utils/embeds";

export const AuthMiddleware = createMiddleware<void>(
	async ({ context, next, stop }) => {
		const requiredRoles = context.command.props.requiredRoles;

		if (!requiredRoles || requiredRoles.includes(CONFIG.ROLES.EVERYONE))
			return next();

		const userRoles = context.member?.roles.keys || [];

		const hasPermission = requiredRoles.some((roleId) =>
			userRoles.includes(roleId),
		);

		if (!hasPermission) {
			await context.write({
				embeds: [Embeds.noPermissionsEmbed()],
				flags: MessageFlags.Ephemeral,
			});

			return stop(
				`No tiene los roles requeridos:  ${requiredRoles.join(", ")}`,
			);
		}

		return next();
	},
);
