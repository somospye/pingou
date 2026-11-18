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
import { estimateComplexity, needsFreshInfo } from "@/utils/aiComplexity";
import {
	cleanAiText,
	splitForDiscord,
	startTyping,
	withSingleSource,
} from "@/utils/aiReply";
import { commandMention } from "@/utils/commandMention";

/**
 * Construye un ActionRow con el botón "📚 Ver fuentes (N)" cuando hay 2+
 * fuentes. Guarda las URLs en el store en memoria con TTL y embebe el key
 * en el customId. Con 1 sola fuente devuelve undefined porque la URL ya va
 * al final del texto.
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

type Source = { url: string; content: string };

// Fuentes de la última búsqueda de cada usuario, para reusarlas en
// repreguntas. Solo en memoria: se pierden al reiniciar el bot.
const RECENT_SOURCES_TTL_MS = 10 * 60 * 1000;
const MAX_MERGED_SOURCES = 4;
const recentSources = new Map<
	string,
	{ sources: Source[]; expiresAt: number }
>();

function getRecentSources(userId: string): Source[] {
	const entry = recentSources.get(userId);
	if (!entry || entry.expiresAt < Date.now()) {
		recentSources.delete(userId);
		return [];
	}
	return entry.sources;
}

function saveRecentSources(userId: string, sources: Source[]) {
	recentSources.set(userId, {
		sources,
		expiresAt: Date.now() + RECENT_SOURCES_TTL_MS,
	});
	for (const [id, entry] of recentSources) {
		if (entry.expiresAt < Date.now()) recentSources.delete(id);
	}
}

/** Fuentes nuevas primero, después las anteriores que no estén repetidas. */
function mergeSources(fresh: Source[], previous: Source[]): Source[] {
	const seen = new Set(fresh.map((src) => src.url));
	return [...fresh, ...previous.filter((src) => !seen.has(src.url))].slice(
		0,
		MAX_MERGED_SOURCES,
	);
}

// Con menos de esto de cooldown restante no se avisa: se espera escribiendo
const SHORT_WAIT_MS = 4_000;
// Espera entre preguntas de un mismo usuario, contada desde la respuesta
const COOLDOWN_SECONDS = 8;
const COOLDOWN_KEY = "ai-mention";
const THINKING_EMOJI = "<:thonk:887124153445023765>";

// Usuarios con una respuesta en curso: no se procesa otra mención suya
// hasta que termine
const inProgress = new Set<string>();

// Pedidos de olvidar o borrar la conversación con Pingou. Se responden sin
// IA para que el modelo no diga "ya lo olvidé" cuando no puede hacerlo.
const FORGET_REQUEST = new RegExp(
	[
		String.raw`\bolv[ií]da(r|te|lo|me|rlo)?\b.{0,40}\b(todo|esto|eso|nuestra|la conversaci[oó]n|el historial|lo anterior|de m[ií]|lo que (te )?(dije|hablamos|pregunt[eé]))`,
		String.raw`\bborr(a|á|ar|es|alo)(?=\s).{0,30}\b(nuestra|tu|mi) (conversaci[oó]n|historial|memoria|chat)\b`,
	].join("|"),
	"i",
);

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

	if (inProgress.has(userId)) {
		await message
			.reply({
				content: `${THINKING_EMOJI} Dame un momento, todavía estoy con tu pregunta anterior`,
			})
			.catch((err) => console.error("Error sending busy notice:", err));
		return true;
	}

	const currentCooldown = await cooldownService.getCooldown(
		userId,
		COOLDOWN_KEY,
	);
	const remainingMs = currentCooldown
		? currentCooldown.expiresAt.getTime() - Date.now()
		: 0;
	if (remainingMs >= SHORT_WAIT_MS) {
		await message
			.reply({
				content: `${THINKING_EMOJI} Dejame pensar, espera **${Math.ceil(remainingMs / 1000)} segundos**`,
			})
			.catch((err) => console.error("Error sending cooldown notice:", err));
		return true;
	}

	inProgress.add(userId);
	try {
		if (remainingMs > 0) {
			// Si falta poco, en vez de avisar mostramos "escribiendo..." y
			// esperamos a que termine el cooldown antes de llamar a la API
			const stopWaitTyping = startTyping(client, message.channelId);
			await new Promise((resolve) => setTimeout(resolve, remainingMs));
			await stopWaitTyping();
		}

		const usedAi = await answerMention(message, client);
		if (usedAi) {
			await cooldownService
				.setCooldown(userId, COOLDOWN_KEY, COOLDOWN_SECONDS)
				.catch((err) => console.error("Error setting AI cooldown:", err));
		}
	} catch (err) {
		console.error("Error handling AI mention:", err);
	} finally {
		inProgress.delete(userId);
	}

	return true;
}

/** Responde una mención. Devuelve true si se usó la IA. */
async function answerMention(
	message: Message,
	client: UsingClient,
): Promise<boolean> {
	const userId = message.author.id;
	const reply = (content: string) =>
		message
			.reply({ content, allowed_mentions: { parse: [], replied_user: true } })
			.catch((err) => console.error("Error sending AI reply:", err));

	// Extraemos el contenido limpio quitando el mention al bot
	const cleanContent = (message.content ?? "")
		.replaceAll(new RegExp(`<@!?${client.me.id}>`, "g"), "")
		.trim();
	const hasAttachments = message.attachments.length > 0;
	const replyTo = getReplyContext(message, client.me.id);

	if (!hasAttachments && FORGET_REQUEST.test(cleanContent)) {
		const forget = await commandMention(client, "olvidar");
		await reply(
			`Eso no lo puedo borrar yo. Usa ${forget} y confirma: ahí se borra tu historial conmigo.`,
		);
		return false;
	}

	// Mención sin texto ni adjuntos. Sin el intent de Message Content no
	// podemos leer los mensajes anteriores del canal, así que solo usamos el
	// mensaje al que responde (si se puede leer) o preguntamos.
	if (!cleanContent && !hasAttachments && !replyTo) {
		await reply("¿En qué te ayudo?");
		return false;
	}

	const question =
		cleanContent ||
		(replyTo
			? "Responde o comenta el mensaje al que estoy respondiendo."
			: "Analiza los adjuntos.");
	const promptMessages = [`${message.author.username}: ${question}`];

	// "Pingou está escribiendo..." mientras se genera la respuesta. Se quita
	// solo cuando el bot manda el mensaje.
	const stopTyping = startTyping(client, message.channelId);

	// El modelo dentro de researchMultiple decide por sí mismo si investigar
	// (0 queries = no investiga) y cuántas búsquedas hacer. Solo verificamos
	// que haya contenido mínimo para no llamar al modelo en menciones vacías.
	// El feature flag CONFIG.AI.RESEARCH_ENABLED permite desactivar todo el
	// módulo de investigación web sin tocar el código.
	const shouldResearch = CONFIG.AI.RESEARCH_ENABLED && cleanContent.length >= 4;

	// MEGA-CALL #1: una sola call al modelo decide si necesita research,
	// genera queries, y trae un answer (directo o fallback). Si no hay
	// research, terminamos en 1 sola llamada total.
	// URLs de las fuentes usadas, para el botón "Ver fuentes" o el link final
	let sourceUrls: string[] | undefined;
	let text: string;

	// Historial con el usuario y mensaje al que responde, si lo hay
	const context: AskContext = {
		history: await aiHistoryService.getContext(userId).catch((err) => {
			console.error("Error loading AI history:", err);
			return [];
		}),
		replyTo,
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
		// Las reglas deciden cuando el caso es claro; si no, decide el planner
		const estimated = estimateComplexity(cleanContent);
		const complex =
			estimated === "complex" || (estimated !== "simple" && plan.complex);
		const tier = complex ? "COMPLEX" : "FAST";
		// Si la pregunta habla de algo que pudo cambiar (noticias, versiones,
		// precios...) se busca aunque el planner no lo haya pedido; sin
		// queries propias, se busca la pregunta tal cual
		// Repreguntas: si responde a Pingou y la pregunta anterior era sobre
		// algo reciente, se vuelve a buscar combinando las dos
		const lastQuestion = context.history
			?.filter((t) => t.role === "user")
			.at(-1)?.content;
		const followUpFresh =
			replyTo?.author === "Pingou" &&
			!!lastQuestion &&
			needsFreshInfo(lastQuestion);
		const fresh = needsFreshInfo(cleanContent) || followUpFresh;
		const queries = plan.queries.length
			? plan.queries
			: fresh
				? [followUpFresh ? `${lastQuestion} ${cleanContent}` : cleanContent]
				: [];
		const research = (plan.needsResearch || fresh) && queries.length > 0;
		console.info(
			`[ai] complejidad: reglas=${estimated ?? "dudosa"} planner=${plan.complex ? "complex" : "simple"} -> ${tier} | búsqueda: planner=${plan.needsResearch} reglas=${fresh} -> ${research}`,
		);

		if (research) {
			const slot = await cooldownService
				.claimRateLimitSlot(
					userId,
					"ai-research",
					CONFIG.AI.RESEARCH_PER_MINUTE,
					60,
				)
				.catch((err) => {
					console.error("Error claiming research slot:", err);
					return { ok: true } as const;
				});

			const found = slot.ok
				? await webResearchService.researchMultiple(cleanContent, queries)
				: null;
			// En una repregunta se suman las fuentes de la búsqueda anterior, así
			// se puede seguir profundizando aunque la nueva no traiga nada
			const previous =
				replyTo?.author === "Pingou" ? getRecentSources(userId) : [];
			const sources = mergeSources(found?.sources ?? [], previous);
			console.info(
				`[ai] búsqueda: ${slot.ok ? `${found?.sources.length ?? 0} fuentes nuevas` : "límite por minuto alcanzado"}, ${previous.length} anteriores`,
			);

			if (sources.length) {
				saveRecentSources(userId, sources);
				sourceUrls = sources.map((src) => src.url);
				// MEGA-CALL #2: synthesize con fuentes crudas. Hace
				// filtración + extracción + síntesis en 1 call.
				// Las noticias y datos recientes los arma el modelo potente:
				// el rápido tiende a creerle más a lo que sabe que a las fuentes
				const synth = await aiService.synthesizeAnswer(
					cleanContent,
					sources,
					fresh ? "COMPLEX" : tier,
					context,
				);
				text = synth.text;
			} else {
				// Sin fuentes: responde el modelo con el historial; la respuesta
				// corta del planner queda solo si esto falla
				const chatResult = await aiService.chat(
					promptMessages,
					undefined,
					tier,
					context,
				);
				text = chatResult.failed ? plan.answer : chatResult.text;
			}
		} else {
			// Sin búsqueda: la respuesta completa la escribe el modelo del tier
			// (la del planner es corta y solo queda de respaldo)
			const chatResult = await aiService.chat(
				promptMessages,
				undefined,
				tier,
				context,
			);
			text = chatResult.failed ? plan.answer : chatResult.text;
		}
	} else {
		// Pregunta muy corta, respuesta a un mensaje sin texto propio o
		// investigación desactivada: chat directo con el modelo rápido
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

	const historyQuestion =
		cleanContent || (replyTo ? "(respondió a un mensaje)" : "(adjuntos)");
	await aiHistoryService
		.record(userId, historyQuestion, text)
		.catch((err) => console.error("Error saving AI history:", err));

	// Botón "📚 Ver fuentes" cuando hay 2+ fuentes (con 1 sola va al final
	// del texto). Va en el ÚLTIMO mensaje para que el usuario lo encuentre al
	// terminar de leer la respuesta.
	const sourcesRow = buildSourcesRow(sourceUrls);
	const chunks = splitForDiscord(
		withSingleSource(cleanAiText(text), sourceUrls),
	);

	await stopTyping();
	for (const [i, chunk] of chunks.entries()) {
		const isLast = i === chunks.length - 1;
		await message
			.reply({
				content: chunk,
				// Solo el primer mensaje menciona al usuario en el reply: así se
				// resalta y le llega una sola notificación aunque se parta
				allowed_mentions: { parse: [], replied_user: i === 0 },
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
