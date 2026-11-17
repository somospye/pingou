import { ComponentCommand, type ComponentContext } from "seyfert";
import { CONFIG } from "@/config";
import { Embeds } from "@/utils/embeds";
import {
	buildCloseConfirm,
	buildStatus,
	NOTICES,
	THREAD_CLOSE_CANCEL_ID,
	THREAD_CLOSE_CONFIRM_PREFIX,
	THREAD_CLOSE_PREFIX,
	type ThreadNoticeKind,
} from "@/utils/threadNotices";

const CLOSED_PREFIX = "🔒 ";
const STAFF_ROLES = [CONFIG.ROLES.ADMIN, CONFIG.ROLES.MODERATOR];

type Ctx = ComponentContext<"Button">;

/**
 * Cierre de hilos de ofertas y servicios en dos pasos, todo con
 * interacciones (no necesita intents privilegiados):
 * 1. "Cerrar" responde con una confirmación efímera. Si es del staff y no el
 *    autor, le recuerda que debe tener un motivo.
 * 2. "Cerrar" de la confirmación avisa en el hilo, le agrega 🔒 al nombre,
 *    lo bloquea, lo archiva y deja registro en el canal de moderación.
 * Solo pueden cerrar el autor del post (su id viaja en el customId) o el staff
 * (admin o moderador).
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
			return ctx.update(buildStatus("Cancelado", "El hilo sigue abierto."));
		}

		const [prefix, kind, authorId] = ctx.customId.split(":") as [
			string,
			ThreadNoticeKind,
			string,
		];
		const notice = NOTICES[kind] ?? NOTICES.job;
		const isConfirm = prefix === THREAD_CLOSE_CONFIRM_PREFIX;
		const isAuthor = ctx.author.id === authorId;
		const memberRoles = ctx.member?.roles.keys ?? [];
		const isStaff = STAFF_ROLES.some((id) => memberRoles.includes(id));

		const fail = (title: string, detail?: string) =>
			isConfirm
				? ctx.update(buildStatus(title, detail))
				: ctx.write(buildStatus(title, detail, { ephemeral: true }));

		if (!isAuthor && !isStaff) {
			return fail(
				"No puedes cerrar este hilo",
				"Solo quien publicó o el staff pueden hacerlo.",
			);
		}

		const thread = await ctx.client.channels
			.fetch(ctx.channelId)
			.catch(() => null);
		if (!thread?.isThread()) return;

		if (thread.name.startsWith(CLOSED_PREFIX)) {
			return fail("Este hilo ya está cerrado");
		}

		// Si el autor es del staff, cuenta como autor
		const byStaff = !isAuthor;

		if (!isConfirm) {
			return ctx.write(buildCloseConfirm(kind, authorId, byStaff));
		}

		await ctx.update(buildStatus("Hilo cerrado"));

		const closedBy = byStaff
			? `el staff (<@${ctx.author.id}>)`
			: `<@${ctx.author.id}>`;
		await ctx.client.messages
			.write(thread.id, {
				...buildStatus(
					`🔒 ${notice.closedTitle}`,
					`La cerró ${closedBy}. Ya no se puede responder.`,
				),
				allowed_mentions: { parse: [] },
			})
			.catch((err) => console.error("Failed to send close notice:", err));

		const threadName = thread.name;
		await ctx.client.channels
			.edit(
				thread.id,
				{
					name: `${CLOSED_PREFIX}${threadName}`.slice(0, 100),
					locked: true,
					archived: true,
				},
				{
					reason: `Cerrado por ${ctx.author.username} (${byStaff ? "staff" : "autor"})`,
				},
			)
			.catch((err) => console.error("Failed to close thread:", err));

		await ctx.client.messages
			.write(CONFIG.CHANNELS.MOD_LOG, {
				embeds: [
					Embeds.threadClosedEmbed({
						title: notice.closedTitle,
						threadId: thread.id,
						threadName,
						authorId,
						closedById: ctx.author.id,
						byStaff,
					}),
				],
			})
			.catch((err) => console.error("Failed to log thread close:", err));
	}
}
