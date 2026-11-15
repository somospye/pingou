import { ComponentCommand, type ComponentContext } from "seyfert";
import { MessageFlags } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { Embeds } from "@/utils/embeds";
import {
	buildCloseConfirm,
	buildCloseResult,
	NOTICES,
	THREAD_CLOSE_CANCEL_ID,
	THREAD_CLOSE_CONFIRM_PREFIX,
	THREAD_CLOSE_PREFIX,
	type ThreadNoticeKind,
} from "@/utils/threadNotices";

const CLOSED_PREFIX = "🔒 ";

type Ctx = ComponentContext<"Button">;

/**
 * Cierre de hilos de ofertas y servicios en dos pasos, todo con
 * interacciones (no necesita intents privilegiados):
 * 1. "Cerrar" responde con una confirmación efímera. Si es un admin y no el
 *    autor, le recuerda que debe tener un motivo.
 * 2. "Cerrar" de la confirmación avisa en el hilo, le agrega 🔒 al nombre,
 *    lo bloquea, lo archiva y deja registro en el canal de moderación.
 * Solo pueden cerrar el autor del post (su id viaja en el customId) o un admin.
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
			return ctx.update(buildCloseResult("Cancelado. El hilo sigue abierto."));
		}

		const [prefix, kind, authorId] = ctx.customId.split(":") as [
			string,
			ThreadNoticeKind,
			string,
		];
		const notice = NOTICES[kind] ?? NOTICES.job;
		const isConfirm = prefix === THREAD_CLOSE_CONFIRM_PREFIX;
		const isAuthor = ctx.author.id === authorId;
		const isAdmin = (ctx.member?.roles.keys ?? []).includes(CONFIG.ROLES.ADMIN);

		const fail = (text: string) =>
			isConfirm
				? ctx.update(buildCloseResult(text))
				: ctx.write({ content: text, flags: MessageFlags.Ephemeral });

		if (!isAuthor && !isAdmin) {
			return fail("Solo quien publicó o un admin pueden cerrar este hilo.");
		}

		const thread = await ctx.client.channels
			.fetch(ctx.channelId)
			.catch(() => null);
		if (!thread?.isThread()) return;

		if (thread.name.startsWith(CLOSED_PREFIX)) {
			return fail("Este hilo ya está cerrado.");
		}

		// Si el autor es admin, cuenta como autor
		const byAdmin = !isAuthor;

		if (!isConfirm) {
			return ctx.write(buildCloseConfirm(kind, authorId, byAdmin));
		}

		await ctx.update(buildCloseResult("Hilo cerrado."));

		const closedBy = byAdmin
			? `un admin (<@${ctx.author.id}>)`
			: `<@${ctx.author.id}>`;
		await ctx.client.messages
			.write(thread.id, {
				content: `🔒 **${notice.closedTitle}** por ${closedBy}. El hilo ya no acepta respuestas.`,
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
					reason: `Cerrado por ${ctx.author.username} (${byAdmin ? "admin" : "autor"})`,
				},
			)
			.catch((err) => console.error("Failed to close thread:", err));

		await ctx.client.messages
			.write(CONFIG.CHANNELS.MOD_LOG, {
				embeds: [
					Embeds.threadClosedEmbed({
						kind,
						threadId: thread.id,
						threadName,
						authorId,
						closedById: ctx.author.id,
						byAdmin,
					}),
				],
			})
			.catch((err) => console.error("Failed to log thread close:", err));
	}
}
