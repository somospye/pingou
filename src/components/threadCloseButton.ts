import { ComponentCommand, type ComponentContext } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import {
	NOTICES,
	THREAD_CLOSE_PREFIX,
	type ThreadNoticeKind,
} from "@/utils/threadNotices";

const CLOSED_PREFIX = "🔒 ";
const STAFF_ROLES = [
	CONFIG.ROLES.ADMIN,
	CONFIG.ROLES.MODERATOR,
	CONFIG.ROLES.HELPER,
];

/**
 * Cierra el hilo de una oferta o servicio: avisa en el hilo, le agrega 🔒 al
 * nombre, lo bloquea y lo archiva. Solo puede usarlo el autor del post (su
 * id viaja en el customId) o el staff.
 */
export default class ThreadCloseButton extends ComponentCommand {
	override componentType = "Button" as const;

	override filter(ctx: ComponentContext<typeof this.componentType>) {
		return ctx.customId.startsWith(`${THREAD_CLOSE_PREFIX}:`);
	}

	override async run(ctx: ComponentContext<typeof this.componentType>) {
		const [, kind, authorId] = ctx.customId.split(":") as [
			string,
			ThreadNoticeKind,
			string,
		];
		const notice = NOTICES[kind] ?? NOTICES.job;
		const memberRoles = ctx.member?.roles.keys ?? [];
		const isStaff = STAFF_ROLES.some((id) => memberRoles.includes(id));

		if (ctx.author.id !== authorId && !isStaff) {
			return ctx.write({
				content: "Solo quien publicó o el staff pueden cerrar este hilo.",
				flags: MessageFlags.Ephemeral,
			});
		}

		const thread = await ctx.client.channels
			.fetch(ctx.channelId)
			.catch(() => null);
		if (!thread?.isThread()) return;

		if (thread.name.startsWith(CLOSED_PREFIX)) {
			return ctx.write({
				content: "Este hilo ya está cerrado.",
				flags: MessageFlags.Ephemeral,
			});
		}

		await ctx.write({
			content: `🔒 **${notice.closedTitle}** por <@${ctx.author.id}>. El hilo ya no acepta respuestas.`,
			allowed_mentions: { parse: [] },
		});

		await ctx.client.channels
			.edit(
				thread.id,
				{
					name: `${CLOSED_PREFIX}${thread.name}`.slice(0, 100),
					locked: true,
					archived: true,
				},
				{ reason: `Cerrado por ${ctx.author.username}` },
			)
			.catch((err) => console.error("Failed to close thread:", err));
	}
}
