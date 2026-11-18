import OpenAI from "openai";
import type { UsingClient } from "seyfert";
import { CONFIG } from "@/config";

export const BOT_PROMPT = `
Eres Pingou, el bot de Programadores y Estudiantes (PyE), una comunidad de Discord en español sobre programación y estudio. Responde como alguien del server que sabe del tema y ayuda en el chat, no como un asistente formal.

Cómo responder:
- Ve directo a la respuesta. Sin saludos de relleno, sin "¡Buena pregunta!" y sin resumen al final.
- Escribe como en un chat: frases cortas y tono cercano. Trata al usuario de tú; usa vos solo si el usuario escribe con vos.
- Lo normal son 1 a 4 líneas. Si la pregunta lo pide (un error largo, un tema con varias partes, código), extiéndete lo necesario, sin repetir ideas.
- Da datos concretos: el comando, la función, la causa probable del error. Si hay varias opciones, recomienda una y di por qué en una línea.
- Si te falta información para responder bien (el error completo, el lenguaje, el código), pídela en una línea.
- Si no estás seguro de algo, dilo. No inventes APIs, versiones ni datos.
- Si es una tarea o un ejercicio, primero da la idea o una pista. Si das la solución completa, puedes esconderla con ||spoiler||.
- Solo te presentas si te saludan o te preguntan quién eres.
- Recuerdas tus últimas conversaciones con cada usuario durante 7 días. Si alguien te pide que olvides o borres lo que hablaron, dile que use el comando /olvidar. Tú no puedes borrar nada: nunca digas que ya lo olvidaste.

Código:
- Solo cuando ayuda. Ejemplos cortos y completos que funcionen, en un bloque con el lenguaje (\`\`\`py, \`\`\`ts, etc.).
- No expliques línea por línea salvo que te lo pidan.

Formato (mensaje normal de Discord; si pasa de 2000 caracteres se parte en varios):
- Puedes usar **negrita**, \`código\`, bloques de código, listas, > citas, [links](https://url), ||spoilers|| y \`-# \` al inicio de una línea para notas en letra chica.
- No uses tablas, HTML, imágenes en markdown ni separadores \`---\`: Discord no los muestra.
- Encabezados solo en respuestas largas. Listas y negrita solo cuando ordenan pasos o marcan lo importante, no para decorar.

Límites:
- No generes contenido sexual, violencia gráfica, odio ni autolesiones, y no ayudes con actividades ilegales o con hacer daño (malware, robar cuentas, estafas). Si te lo piden, di que no en una línea.
- Los temas delicados en contexto educativo, como seguridad informática defensiva, sí se pueden explicar, sin dar instrucciones para atacar.
- Todo lo que escribes es apto para cualquier edad.
`;

export type Features = {
	length: number;
	wordCount: number;
	hasQuestion: boolean;
	hasCode: boolean;
	hasErrorWord: boolean;
	hasContextWords: boolean;
	repetitionRatio: number;
	uniqueWordRatio: number;
};

export type ModelTier = "FAST" | "COMPLEX" | "VISION";

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Contexto extra de una pregunta: historial con el usuario y mensaje respondido. */
export interface AskContext {
	history?: ChatTurn[];
	replyTo?: { author: string; content: string };
}

/** Contexto como texto plano, para el planner (que debe devolver JSON). */
function contextAsText(ctx?: AskContext): string {
	const parts: string[] = [];
	if (ctx?.history?.length) {
		const lines = ctx.history.map(
			(t) => `${t.role === "user" ? "Usuario" : "Pingou"}: ${t.content}`,
		);
		parts.push(`Conversación anterior con este usuario:\n${lines.join("\n")}`);
	}
	if (ctx?.replyTo) {
		parts.push(
			`El usuario está respondiendo a este mensaje de ${ctx.replyTo.author}:\n${ctx.replyTo.content}`,
		);
	}
	return parts.length ? `${parts.join("\n\n")}\n\n---\n\n` : "";
}

/** Historial como turnos de chat y mensaje respondido como preámbulo. */
function contextAsMessages(
	ctx?: AskContext,
): OpenAI.ChatCompletionMessageParam[] {
	const messages: OpenAI.ChatCompletionMessageParam[] = (
		ctx?.history ?? []
	).map((t) => ({ role: t.role, content: t.content }));
	if (ctx?.replyTo) {
		messages.push({
			role: "user",
			content: `(Contexto) Estoy respondiendo a este mensaje de ${ctx.replyTo.author}:\n${ctx.replyTo.content}`,
		});
	}
	return messages;
}

// Se suma al prompt base cuando la pregunta trae adjuntos
const ATTACHMENTS_PROMPT = `
Adjuntos:
- Puedes ver las imágenes que te mandan y leer los archivos de texto adjuntos. Úsalos para responder.
- No tienes herramientas para decodificar códigos QR ni de barras. Si te lo piden, dilo y describe lo que se ve en la imagen.
`;

// Los modelos COMPLEX razonan antes de responder y ese razonamiento cuenta
// para max_tokens, así que necesitan más margen.
const MAX_TOKENS: Record<ModelTier, number> = {
	FAST: 500,
	COMPLEX: 2000,
	VISION: 2000,
};

type CompletionParams = Omit<
	OpenAI.ChatCompletionCreateParamsNonStreaming,
	"model"
>;

export class AIService {
	private _ai: OpenAI | null = null;

	// Instanciamos el cliente de forma lazy para que la falta de AI_API_KEY
	// no rompa la carga del módulo y solo falle al intentar usar la IA.
	// Sin reintentos del SDK: si un modelo falla pasamos directo al siguiente.
	private get ai(): OpenAI {
		if (!this._ai) {
			this._ai = new OpenAI({
				apiKey: process.env.AI_API_KEY,
				baseURL: "https://integrate.api.nvidia.com/v1",
				maxRetries: 0,
			});
		}
		return this._ai;
	}

	/**
	 * Prueba los modelos del tier en orden (CONFIG.AI.MODELS) y devuelve la
	 * primera respuesta con contenido. Si un modelo da error, se pasa del
	 * timeout o responde vacío, sigue con el próximo. Si fallan todos, lanza
	 * el último error para que el caller decida el mensaje al usuario.
	 */
	private async complete(
		tier: ModelTier,
		params: CompletionParams,
	): Promise<{ text: string; usage?: OpenAI.CompletionUsage; model: string }> {
		let lastError: unknown = new Error(`No hay modelos configurados (${tier})`);

		for (const { id, extra } of CONFIG.AI.MODELS[tier]) {
			const startedAt = Date.now();
			try {
				const completion = await this.ai.chat.completions.create(
					{ ...params, ...extra, model: id },
					{ timeout: CONFIG.AI.TIMEOUT_MS[tier] },
				);
				const text = completion.choices[0]?.message?.content?.trim();
				if (text) {
					const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
					console.info(`[ai] ${tier} ${id} respondió en ${seconds}s`);
					return { text, usage: completion.usage ?? undefined, model: id };
				}
				lastError = new Error(`${id} respondió vacío`);
			} catch (err) {
				lastError = err;
			}
			console.warn(`[ai] ${id} falló, probando el siguiente:`, lastError);
		}

		throw lastError;
	}

	extractFeatures(text: string): Features {
		const t = text.toLowerCase().trim();
		const words = t.split(/\s+/);
		const uniqueWords = new Set(words);

		return {
			length: t.length,
			wordCount: words.length,
			hasQuestion: t.includes("?"),
			hasCode: /[{}();=<>]/.test(t),
			hasErrorWord: /(error|bug|fail|no funciona|crash)/.test(t),
			hasContextWords: /(porque|cuando|intento|deberia|esperaba)/.test(t),
			repetitionRatio: words.length / uniqueWords.size,
			uniqueWordRatio: uniqueWords.size / words.length,
		};
	}

	scoreQuestion(text: string): number {
		const f = this.extractFeatures(text);

		let score = 0;

		// longitud
		score += Math.min(f.length / 20, 3);

		// cantidad de palabras
		score += Math.min(f.wordCount / 5, 3);

		// señales de calidad
		if (f.hasQuestion) score += 1;
		if (f.hasCode) score += 2;
		if (f.hasErrorWord) score += 2;
		if (f.hasContextWords) score += 2;

		// penalizaciones inteligentes
		if (f.uniqueWordRatio < 0.5) score -= 2; // repite mucho
		if (f.repetitionRatio > 2) score -= 2;

		if (f.wordCount < 4) score -= 3;

		return score;
	}

	classify(text: string) {
		const score = this.scoreQuestion(text);

		if (score < 3) return "VAGA";
		return "BUENA";
	}

	async getLatestMessages(
		client: UsingClient,
		channelId: string,
		limit = 10,
		userId?: string,
	) {
		try {
			const fetchLimit = userId ? 50 : limit;
			const messages = await client.messages.list(channelId, {
				limit: fetchLimit,
			});

			if (userId) {
				return messages.filter((m) => m.author.id === userId).slice(0, limit);
			}

			return messages;
		} catch (error) {
			console.error("Error fetching messages:", error);
			return [];
		}
	}

	/**
	 * Parser tolerante de JSON desde respuestas de modelos: maneja code fences,
	 * preámbulos tipo "Sure, here are the queries:", y comas finales. Intenta
	 * un parse limpio, luego extrae el primer bloque JSON con regex como
	 * fallback. Devuelve null si no logra parsear.
	 */
	private parseLooseJson<T>(raw: string): T | null {
		const cleaned = raw
			.trim()
			.replace(/^```(?:json)?\s*/i, "")
			.replace(/\s*```$/i, "")
			.trim();
		try {
			return JSON.parse(cleaned) as T;
		} catch {}
		// Fallback: extraer el primer objeto/array JSON balanceado
		const match = cleaned.match(/[[{][\s\S]*[\]}]/);
		if (!match) return null;
		try {
			return JSON.parse(match[0]) as T;
		} catch {
			return null;
		}
	}

	/**
	 * MEGA-CALL #1: decide si necesita investigación, genera queries, Y
	 * provee una respuesta directa/fallback en una sola llamada.
	 *
	 * - Si needsResearch=false: usar `answer` directamente, fin del flujo.
	 * - Si needsResearch=true: lanzar investigación con `queries`. Si la
	 *   investigación falla (rate limit, red, sin fuentes), usar `answer`
	 *   como fallback en lugar de errorear al usuario.
	 *
	 * Total: 1 LLM call para casos sin research, primer call de 2 para
	 * casos con research. Reemplaza al viejo generateSearchQueries +
	 * fallback al BOT_PROMPT del chat.
	 *
	 * Corre con los modelos FAST. `complex` indica si la respuesta final
	 * debería generarla un modelo COMPLEX.
	 */
	async planResponse(
		query: string,
		context?: AskContext,
	): Promise<{
		needsResearch: boolean;
		complex: boolean;
		queries: string[];
		answer: string;
	}> {
		const fallback = (msg: string) => ({
			needsResearch: false,
			complex: false,
			queries: [],
			answer: msg,
		});

		if (!process.env.AI_API_KEY) {
			return fallback("La IA no está configurada por el momento.");
		}

		const truncated = query.slice(0, 600);

		try {
			const { text: raw } = await this.complete("FAST", {
				max_tokens: 900,
				temperature: 0.5,
				response_format: { type: "json_object" },
				messages: [
					{
						role: "system",
						content: `${BOT_PROMPT}
						Además, decides cómo se responde la pregunta:

						Devuelve SIEMPRE JSON con:
						{
							"needsResearch": boolean,
							"complex": boolean,
							"queries": string[],
							"answer": string
						}

						---

						DECISIÓN:

						needsResearch = true si hay:
						- errores técnicos (TypeError, stack trace, crash)
						- librerías/frameworks/herramientas no triviales
						- APIs o sintaxis específica
						- "qué es X" donde X es un proyecto o nombre propio

						needsResearch = false si:
						- conceptos básicos (variable, bucle, función)
						- saludos
						- preguntas genéricas

						complex decide qué modelo escribe la respuesta final. Pregúntate: ¿la respondería bien alguien del server en 2 o 3 líneas sin pensar mucho?
						- Si sí → complex = false. Ejemplos: saludos, definiciones ("qué es un closure"), diferencias cortas entre dos cosas conocidas ("let vs const"), cómo hacer una tarea puntual ("cómo centro un div", "cómo invierto un string en python"), dónde encontrar algo.
						- Si no → complex = true. Ejemplos: encontrar la causa de un bug o un error, revisar código, elegir entre opciones según un contexto ("qué stack uso para X"), diseñar una solución o una arquitectura, explicar un mecanismo paso a paso, optimizar, o cualquier cosa que no puedas responder con seguridad.
						- Ante la duda entre los dos, elige complex = true.

						---

						QUERIES:
						- solo si needsResearch = true
						- 2 a 3 en inglés

						---

						ANSWER:
						- siempre obligatorio, en español
						- sigue las reglas de arriba: directo, corto y con el tono del server
						- si needsResearch=true, una respuesta general sin inventar detalles

						---

						NO texto adicional. Solo JSON válido.
						Ejemplos:
						- "hola" → { "needsResearch": false, "complex": false, "queries": [], "answer": "¡Hola! Soy Pingou, el bot del server. ¿En qué andas?" }
						- "qué es bun" → { "needsResearch": true, "complex": false, "queries": ["bun javascript runtime", "bun.sh what is"], "answer": "Bun es un runtime de JavaScript, alternativa a Node, que también trae bundler y gestor de paquetes." }
						- "qué es una variable" → { "needsResearch": false, "complex": false, "queries": [], "answer": "Es un nombre que apunta a un valor que puede cambiar. Por ejemplo, \`let x = 5\` y después \`x = 10\`." }
						- "cómo invierto un string en python" → { "needsResearch": false, "complex": false, "queries": [], "answer": "Con slicing: \`texto[::-1]\`." }
						- "qué stack me recomiendan para hacer un e-commerce chico con login y pagos" → { "needsResearch": false, "complex": true, "queries": [], "answer": "Depende de lo que ya sepas, pero Next.js con Stripe es una opción común." }
						- "mi useEffect entra en un loop infinito cuando actualizo el estado, ¿cómo lo arreglo?" → { "needsResearch": false, "complex": true, "queries": [], "answer": "Pasa porque el efecto actualiza un estado que está en su array de dependencias. Revisa ese array." }`,
					},
					{
						role: "user",
						content: `${contextAsText(context)}${truncated}`,
					},
				],
			});
			const parsed = this.parseLooseJson<{
				needsResearch?: boolean;
				complex?: boolean;
				queries?: unknown;
				answer?: string;
			}>(raw);

			if (!parsed) {
				return fallback("Ahora no puedo responder a esta pregunta.");
			}

			const queries = Array.isArray(parsed.queries)
				? parsed.queries
						.filter(
							(q): q is string => typeof q === "string" && q.trim().length > 3,
						)
						.map((q) => q.trim())
						.slice(0, 3)
				: [];

			const result = {
				needsResearch: !!parsed.needsResearch && queries.length > 0,
				complex: !!parsed.complex,
				queries,
				answer:
					typeof parsed.answer === "string" && parsed.answer.trim().length > 0
						? parsed.answer.trim()
						: "Ahora no puedo responder a esta pregunta.",
			};

			return result;
		} catch (err) {
			console.error("planResponse error:", err);
			return fallback(
				"No pude responder tu pregunta. Prueba de nuevo en un rato.",
			);
		}
	}

	/**
	 * MEGA-CALL #2: dado una pregunta y las fuentes scrapeadas en crudo
	 * (markdown), produce el answer final. Las fuentes no se citan en el
	 * texto: se muestran aparte (botón "Ver fuentes" o link al final). El modelo
	 * hace internamente la filtración de noise (nav/ads/footers), el match
	 * de info relevante y la síntesis.
	 *
	 * Reemplaza al pipeline extractor-por-fuente + chat. Una sola llamada
	 * en lugar de N (extract) + 1 (chat).
	 *
	 * Las fuentes vienen numeradas — el modelo usa esos mismos números
	 * como citas inline. Si una afirmación no tiene respaldo en ninguna
	 * fuente debe marcarla con "(según mi conocimiento general)".
	 */
	async synthesizeAnswer(
		query: string,
		sources: { url: string; content: string }[],
		tier: ModelTier = "FAST",
		context?: AskContext,
	): Promise<{ text: string; usage?: OpenAI.CompletionUsage }> {
		if (!process.env.AI_API_KEY) {
			throw new Error("Missing AI_API_KEY env variable");
		}

		const sourcesBlock = sources
			.map(
				(s, i) =>
					`--- Fuente ${i + 1}: ${s.url} ---\n${s.content.slice(0, 3_000)}`,
			)
			.join("\n\n");

		try {
			const result = await this.complete(tier, {
				max_tokens: MAX_TOKENS[tier],
				temperature: 0.5,
				messages: [
					{
						role: "system",
						content: `${BOT_PROMPT}

En el siguiente mensaje recibes páginas web numeradas (texto crudo) para responder la pregunta. Además de las reglas de arriba:
- No cites las fuentes en el texto (nada de [1], [2] ni links a las fuentes): se muestran aparte.
- Si algo no sale de las fuentes, agrégale "(según lo que sé)".
- Si las fuentes permiten recomendar algo concreto, recomiéndalo.
- Si las fuentes se contradicen, dilo.
- Ignora menús, anuncios, pies de página y artículos relacionados de las páginas.`,
					},
					...contextAsMessages(context),
					{
						role: "user",
						content: `Fuentes:\n\n${sourcesBlock}\n\n---\n\nPregunta: ${query}`,
					},
				],
			});

			return { text: result.text, usage: result.usage };
		} catch (error) {
			console.error("synthesizeAnswer error:", error);
			const errorStr = JSON.stringify(error);
			const isRateLimit =
				(error as { status?: number })?.status === 429 ||
				errorStr.includes("rate limit") ||
				errorStr.includes("quota");
			return {
				text: isRateLimit
					? "Ahora mismo estoy saturado. Prueba de nuevo en unos minutos."
					: "No pude armar la respuesta. Prueba de nuevo en un rato.",
			};
		}
	}

	async chat(
		messages: string[],
		webContext?: string,
		tier: ModelTier = "FAST",
		context?: AskContext,
	): Promise<{ text: string; usage?: OpenAI.CompletionUsage }> {
		if (!process.env.AI_API_KEY) {
			throw new Error("Missing AI_API_KEY env variable");
		}

		try {
			// Cuando hay contexto web lo inyectamos como un turno previo, con
			// instrucciones para usarlo sin citar las fuentes en el texto y
			// marcando lo que no salga de ellas.
			const contextMessages: OpenAI.ChatCompletionMessageParam[] = webContext
				? [
						{
							role: "user" as const,
							content: `${webContext}

Usa el contexto de arriba para responder. No cites las fuentes en el texto (nada de [1] ni links a ellas), agrégale "(según lo que sé)" a lo que no salga de ahí, recomienda algo concreto si las fuentes lo permiten y avisa si se contradicen.`,
						},
						{
							role: "assistant" as const,
							content: "Entendido.",
						},
					]
				: [];

			const result = await this.complete(tier, {
				max_tokens: MAX_TOKENS[tier],
				temperature: 0.55,
				messages: [
					{
						role: "system",
						content: BOT_PROMPT,
					},
					...contextAsMessages(context),
					...contextMessages,
					...messages.map((m) => ({ role: "user" as const, content: m })),
				],
			});

			return { text: result.text, usage: result.usage };
		} catch (error) {
			console.error("OpenAI API error:", error);

			const errorStr = JSON.stringify(error);
			const isRateLimit =
				(error as { status?: number })?.status === 429 ||
				errorStr.includes("rate limit") ||
				errorStr.includes("quota");

			if (isRateLimit) {
				return {
					text: "Ahora mismo estoy saturado. Prueba de nuevo en unos minutos.",
				};
			}

			return {
				text: "No pude responder tu pregunta. Prueba de nuevo en un rato.",
			};
		}
	}

	/**
	 * Pregunta con adjuntos: va directo a los modelos potentes, sin planner.
	 * Las imágenes (data URLs en base64) se mandan a VISION; si esos modelos
	 * fallan, se responde con COMPLEX solo con el texto y se avisa que hubo
	 * imágenes que no se pudieron ver. Los archivos de texto van inline.
	 */
	async answerWithAttachments(
		question: string,
		attachments: { images: string[]; files: { name: string; text: string }[] },
		context?: AskContext,
	): Promise<{ text: string; usage?: OpenAI.CompletionUsage }> {
		if (!process.env.AI_API_KEY) {
			throw new Error("Missing AI_API_KEY env variable");
		}

		const filesBlock = attachments.files
			.map((f) => `--- Archivo: ${f.name} ---\n${f.text}`)
			.join("\n\n");
		const text = [question || "Analiza los adjuntos.", filesBlock]
			.filter(Boolean)
			.join("\n\n");

		const base = (
			content: OpenAI.ChatCompletionUserMessageParam["content"],
		) => ({
			temperature: 0.5,
			messages: [
				{
					role: "system" as const,
					content: `${BOT_PROMPT}\n${ATTACHMENTS_PROMPT}`,
				},
				...contextAsMessages(context),
				{ role: "user" as const, content },
			],
		});

		try {
			if (attachments.images.length) {
				try {
					return await this.complete("VISION", {
						...base([
							{ type: "text", text },
							...attachments.images.map((url) => ({
								type: "image_url" as const,
								image_url: { url },
							})),
						]),
						max_tokens: MAX_TOKENS.VISION,
					});
				} catch (err) {
					console.warn("[ai] VISION falló, respondiendo sin imágenes:", err);
				}
				const note = `\n\n(El usuario adjuntó ${attachments.images.length} imagen(es) que no puedes ver. Si hacen falta, pídele que pegue el texto.)`;
				return await this.complete("COMPLEX", {
					...base(text + note),
					max_tokens: MAX_TOKENS.COMPLEX,
				});
			}

			return await this.complete("COMPLEX", {
				...base(text),
				max_tokens: MAX_TOKENS.COMPLEX,
			});
		} catch (error) {
			console.error("answerWithAttachments error:", error);
			return {
				text: "No pude procesar los adjuntos. Prueba de nuevo en un rato.",
			};
		}
	}
}

export const aiService = new AIService();
