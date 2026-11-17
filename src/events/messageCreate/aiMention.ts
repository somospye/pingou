import { randomUUID } from "node:crypto";
import { ActionRow, Button, type Message, type UsingClient } from "seyfert";
import { ButtonStyle } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { type AskContext, aiService } from "@/services/ai";
import { aiHistoryService } from "@/services/aiHistoryService";
import { aiSourcesStore } from "@/services/aiSources";
import { cooldownService } from "@/services/cooldown";
import { webResearchService } from "@/services/webResearch";
import { loadAttachments } from "@/utils/aiAttachments";
import {
	splitForDiscord,
	startTyping,
	withSingleSource,
} from "@/utils/aiReply";

/**
 * Construye un ActionRow con el botón "📚 Ver fuentes (N)" cuando hay 2+
 * fuentes. Guarda las URLs en el store en memoria con TTL y embebe el key
 * en el customId. Con 1 sola fuente devuelve undefined porque el footer
 * del embed ya muestra la URL directa.
 */
function buildSourcesRow(
	sourceUrls: string[] | undefined,
): ActionRow<Button> | undefined {
	if (!sourceUrls || sourceUrls.length < 2) return undefined;
	const key = randomUUID().slice(0, 8);
	aiSourcesStore.save(key, sourceUrls);
	return new ActionRow<Button>().setComponents([
		new Button()
			.setCustomId(`ai-sources:${key}`)
			.setLabel(`📚 Ver fuentes (${sourceUrls.length})`)
			.setStyle(ButtonStyle.Secondary),
	]);
}

/**
 * Maneja menciones al bot (@Pingou ...) con respuesta de IA, investigación
 * web adaptativa y rate limit. Devuelve true si el mensaje mencionaba al
 * bot (incluso si rebotó por cooldown), para cortar la cadena.
 */
export async function handleAiMention(
	message: Message,
	client: UsingClient,
): Promise<boolean> {
	if (!message.mentions.users.some((u) => u.id === client.me.id)) return false;

	const userId = message.author.id;
	const cooldownKey = "ai-mention";

	const currentCooldown = await cooldownService.getCooldown(
		userId,
		cooldownKey,
	);
	if (currentCooldown) {
		const remaining = Math.ceil(
			(currentCooldown.expiresAt.getTime() - Date.now()) / 1000,
		);
		await message
			.reply({
				content: `Calma, estás saturando la IA. Espera **${remaining} segundos**.`,
			})
			.catch((err) => console.error("Error sending cooldown notice:", err));
		return true;
	}

	// Extraemos el contenido limpio quitando el mention al bot
	const cleanContent = (message.content ?? "")
		.replaceAll(new RegExp(`<@!?${client.me.id}>`, "g"), "")
		.trim();

	let contextLimit = 2;
	const match = /contexto:\s*(\d+)/i.exec(cleanContent);
	if (match?.[1]) {
		contextLimit = Math.min(Number.parseInt(match[1], 10), 10);
	}

	const hasAttachments = message.attachments.length > 0;

	// "Pingou está escribiendo..." mientras se genera la respuesta. Se quita
	// solo cuando el bot manda el mensaje.
	const stopTyping = startTyping(client, message.channelId);

	// Preparamos el prompt. Si hay contenido directo lo usamos; si la mención
	// vino sin texto, buscamos los últimos mensajes del usuario como contexto.
	let promptMessages: string[];
	// El modelo dentro de researchMultiple decide por sí mismo si investigar
	// (0 queries = no investiga) y cuántas búsquedas hacer. Solo verificamos
	// que haya contenido mínimo para no llamar al modelo en menciones vacías.
	// El feature flag CONFIG.AI.RESEARCH_ENABLED permite desactivar todo el
	// módulo de investigación web sin tocar el código.
	const shouldResearch = CONFIG.AI.RESEARCH_ENABLED && cleanContent.length >= 4;

	if (cleanContent.length > 0) {
		promptMessages = [`${message.author.username}: ${cleanContent}`];
	} else {
		const prevMessages = await aiService.getLatestMessages(
			client,
			message.channelId,
			contextLimit + 1,
			message.author.id,
		);
		if (!prevMessages.length && !hasAttachments) {
			stopTyping();
			return true;
		}
		promptMessages = [...prevMessages]
			.reverse()
			.map((m) => `${m.author.username}: ${m.content ?? ""}`);
	}

	// MEGA-CALL #1: una sola call al modelo decide si necesita research,
	// genera queries, y trae un answer (directo o fallback). Si no hay
	// research, terminamos en 1 sola llamada total.
	let webResult: Awaited<
		ReturnType<typeof webResearchService.researchMultiple>
	> = null;
	let text: string;

	// Historial con el usuario y mensaje al que responde, si lo hay
	const context: AskContext = {
		history: await aiHistoryService.getContext(userId).catch((err) => {
			console.error("Error loading AI history:", err);
			return [];
		}),
		replyTo: getReplyContext(message, client.me.id),
	};

	const loaded = hasAttachments ? await loadAttachments(message) : null;

	if (loaded && (loaded.images.length || loaded.files.length)) {
		// Con adjuntos vamos directo al modelo potente, sin planner
		const result = await aiService.answerWithAttachments(
			cleanContent,
			loaded,
			context,
		);
		text = result.text;
	} else if (shouldResearch) {
		const plan = await aiService.planResponse(cleanContent, context);
		const tier = plan.complex ? "COMPLEX" : "FAST";

		if (plan.needsResearch && plan.queries.length) {
			const slot = await cooldownService
				.claimRateLimitSlot(userId, "ai-research", 2, 60)
				.catch((err) => {
					console.error("Error claiming research slot:", err);
					return { ok: true } as const;
				});

			if (slot.ok) {
				webResult = await webResearchService.researchMultiple(
					cleanContent,
					plan.queries,
				);

				if (webResult?.sources.length) {
					// MEGA-CALL #2: synthesize con fuentes crudas. Hace
					// filtración + extracción + síntesis + citas en 1 call.
					const synth = await aiService.synthesizeAnswer(
						cleanContent,
						webResult.sources,
						tier,
						context,
					);
					text = synth.text;
				} else {
					// Investigación no devolvió fuentes — usamos el fallback del plan
					text = plan.answer;
				}
			} else {
				text = plan.answer;
			}
		} else if (plan.complex) {
			// El modelo rápido marcó la pregunta como complicada: la responde
			// un modelo potente
			const chatResult = await aiService.chat(
				promptMessages,
				undefined,
				"COMPLEX",
				context,
			);
			text = chatResult.text;
		} else {
			// El modelo decidió que no hace falta research, usamos su answer directo
			text = plan.answer;
		}
	} else {
		// Camino sin research por config / contenido muy corto / mención sin texto
		// (vamos al chat clásico con history de mensajes previos)
		const chatResult = await aiService.chat(
			promptMessages,
			undefined,
			"FAST",
			context,
		);
		text = chatResult.text;
	}

	if (loaded?.skipped.length) {
		text += `\n\n-# No pude leer: ${loaded.skipped.join(", ")}`;
	}

	const question = cleanContent || "(adjuntos)";
	await aiHistoryService
		.record(userId, question, text)
		.catch((err) => console.error("Error saving AI history:", err));

	await cooldownService
		.setCooldown(userId, cooldownKey, 15)
		.catch((err) => console.error("Error setting AI cooldown:", err));

	// Botón "📚 Ver fuentes" cuando hay 2+ fuentes (con 1 sola va al final
	// del texto). Va en el ÚLTIMO mensaje para que el usuario lo encuentre al
	// terminar de leer la respuesta.
	const sourcesRow = buildSourcesRow(webResult?.sourceUrls);
	const chunks = splitForDiscord(withSingleSource(text, webResult?.sourceUrls));

	stopTyping();
	for (const [i, chunk] of chunks.entries()) {
		const isLast = i === chunks.length - 1;
		await message
			.reply({
				content: chunk,
				...(isLast && sourcesRow ? { components: [sourcesRow] } : {}),
			})
			.catch((err) => console.error("Error sending AI reply:", err));
	}

	return true;
}

/**
 * Texto del mensaje al que responde el usuario, si se puede leer. Sin el
 * intent de Message Content, Discord solo da el contenido de mensajes del
 * propio bot (texto o embeds); para los de otros usuarios llega vacío y se
 * ignora.
 */
function getReplyContext(
	message: Message,
	botId: string,
): AskContext["replyTo"] {
	const ref = message.referencedMessage;
	if (!ref) return undefined;

	const embedText =
		ref.author.id === botId
			? (ref.embeds ?? [])
					.map((e) => e.description ?? "")
					.filter(Boolean)
					.join("\n")
			: "";
	const content = (ref.content || embedText).trim();
	if (!content) return undefined;

	return {
		author: ref.author.id === botId ? "Pingou" : ref.author.username,
		content: content.slice(0, 1_500),
	};
}
