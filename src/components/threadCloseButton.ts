import {
	ActionRow,
	Button,
	ComponentCommand,
	type ComponentContext,
} from "seyfert";
import { ButtonStyle, MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import {
	NOTICES,
	THREAD_CLOSE_CANCEL_ID,
	THREAD_CLOSE_CONFIRM_PREFIX,
	THREAD_CLOSE_PREFIX,
	type ThreadNoticeKind,
} from "@/utils/threadNotices";

const CLOSED_PREFIX = "🔒 ";
const STAFF_ROLES = [
	CONFIG.ROLES.ADMIN,
	CONFIG.ROLES.MODERATOR,
	CONFIG.ROLES.HELPER,
];

type Ctx = ComponentContext<"Button">;

/**
 * Cierre de hilos de ofertas y servicios en dos pasos, todo con
 * interacciones (no necesita intents privilegiados):
 * 1. "Cerrar" responde con una confirmación que solo ve quien tocó.
 * 2. "Sí, cerrar" avisa en el hilo, le agrega 🔒 al nombre, lo bloquea y lo
 *    archiva. "Cancelar" solo descarta la confirmación.
 * Solo puede cerrar el autor del post (su id viaja en el customId) o el staff.
 */
export default class ThreadCloseButton extends ComponentCommand {
	override componentType = "Button" as const;

	override filter(ctx: Ctx) {
		return (
			ctx.customId.startsWith(`${THREAD_CLOSE_PREFIX}:`) ||
			ctx.customId.startsWith(`${THREAD_CLOSE_CONFIRM_PREFIX}:`) ||
			ctx.customId === THREAD_CLOSE_CANCEL_ID
		);
	}

	override async run(ctx: Ctx) {
		if (ctx.customId === THREAD_CLOSE_CANCEL_ID) {
			return ctx.update({
				content: "Cancelado. El hilo sigue abierto.",
				components: [],
			});
		}

		const [prefix, kind, authorId] = ctx.customId.split(":") as [
			string,
			ThreadNoticeKind,
			string,
		];
		const notice = NOTICES[kind] ?? NOTICES.job;
		const isConfirm = prefix === THREAD_CLOSE_CONFIRM_PREFIX;

		if (!canClose(ctx, authorId)) {
			const content = "Solo quien publicó o el staff pueden cerrar este hilo.";
			return isConfirm
				? ctx.update({ content, components: [] })
				: ctx.write({ content, flags: MessageFlags.Ephemeral });
		}

		const thread = await ctx.client.channels
			.fetch(ctx.channelId)
			.catch(() => null);
		if (!thread?.isThread()) return;

		if (thread.name.startsWith(CLOSED_PREFIX)) {
			const content = "Este hilo ya está cerrado.";
			return isConfirm
				? ctx.update({ content, components: [] })
				: ctx.write({ content, flags: MessageFlags.Ephemeral });
		}

		if (!isConfirm) {
			return ctx.write({
				content: notice.confirmText,
				components: [
					new ActionRow<Button>().setComponents([
						new Button()
							.setCustomId(`${THREAD_CLOSE_CONFIRM_PREFIX}:${kind}:${authorId}`)
							.setLabel("Sí, cerrar")
							.setStyle(ButtonStyle.Danger),
						new Button()
							.setCustomId(THREAD_CLOSE_CANCEL_ID)
							.setLabel("Cancelar")
							.setStyle(ButtonStyle.Secondary),
					]),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		await ctx.update({
			content: "Listo, el hilo quedó cerrado.",
			components: [],
		});

		await ctx.client.messages
			.write(thread.id, {
				content: `🔒 **${notice.closedTitle}** por <@${ctx.author.id}>. El hilo ya no acepta respuestas.`,
				allowed_mentions: { parse: [] },
			})
			.catch((err) => console.error("Failed to send close notice:", err));

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

function canClose(ctx: Ctx, authorId: string): boolean {
	if (ctx.author.id === authorId) return true;
	const memberRoles = ctx.member?.roles.keys ?? [];
	return STAFF_ROLES.some((id) => memberRoles.includes(id));
}
