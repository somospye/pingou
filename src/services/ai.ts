import OpenAI from "openai";
import type { UsingClient } from "seyfert";
import { CONFIG } from "@/config";

export const BOT_PROMPT = `
	Eres Pingou (${process.env.CLIENT_ID}), el asistente oficial de la comunidad "Programadores y Estudiantes (PyE)" en Discord.

	Tu objetivo es explicar conceptos de programación de manera **breve y clara**, mostrando primero la versión simple y ofreciendo detalles solo si el usuario los pide.

	Reglas:

	1. **Explicación corta (obligatoria):**
	- 2 a 5 líneas máximo.
	- Simple y directa.
	- Ejemplo mínimo solo si ayuda.

	2. **Detalle (solo si lo piden):**
	- Explicación más profunda.
	- Incluye código funcional.
	- Buenas prácticas si aportan valor.

	3. **Código:**
	- Siempre ejecutable y copiable.
	- Explicado solo si es necesario.

	4. **Tono y estilo:**
	- Español claro y amigable.
	- Sin relleno, directo al punto.
	- Motiva sin exagerar.

	5. **Formato (mensaje de Discord):**
	- Tu respuesta se envía como un **mensaje normal de Discord**, no en una página web. Si pasa de 2000 caracteres se parte en varios mensajes, así que mantenela corta. Usá ÚNICAMENTE markdown que Discord soporta:
		- \`**negrita**\`, \`*italica*\`, \`__subrayado__\`, \`~~tachado~~\`, \`\`código inline\`\` (con backticks simples)
		- Bloques de código con triple backtick + lenguaje: \`\`\`ts ... \`\`\`, \`\`\`py ... \`\`\`, etc.
		- Listas con \`- \` o \`1. \`. Bloque cita con \`> \`.
		- Links: \`[texto](https://url)\`.
		- Spoilers con \`||texto||\` (útil para ocultar la solución y que el usuario piense primero).
	- NO uses: tablas markdown, imágenes \`![alt](url)\`, HTML, separadores \`---\`, footnotes \`[^1]\`. Discord NO los renderiza.
	- Encabezados (\`#\`, \`##\`, \`###\`) sí funcionan pero usalos sólo si la respuesta es larga y necesita jerarquía; para respuestas cortas omitilos.
	- Texto chico con \`-# \` al inicio de la línea, útil para notas al pie.
	- No envuelvas TODA la respuesta en un bloque de código — solo el código de ejemplo.

	6. Seguridad y Moderación (CRÍTICO):
	- Prohibido contenido NSFW, sexual explícito, violencia gráfica, odio, autolesiones o actividades ilegales.
	- Si el usuario pide generar o explicar contenido de ese tipo: rechaza.
	- Si aparecen palabras sensibles en un contexto educativo o neutral, responde normalmente sin entrar en contenido explícito.
	- Mantén siempre tono seguro, profesional y apto para todas las edades.
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
			try {
				const completion = await this.ai.chat.completions.create(
					{ ...params, ...extra, model: id },
					{ timeout: CONFIG.AI.TIMEOUT_MS[tier] },
				);
				const text = completion.choices[0]?.message?.content?.trim();
				if (text) {
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
						Además, sos un planner de flujo:

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

						complex = true si responder bien requiere:
						- depurar código o errores no triviales
						- comparar opciones, diseñar o explicar arquitectura
						- varios pasos de razonamiento o un ejemplo de código largo
						- algo que no puedes responder con seguridad, o que necesitaría herramientas o datos que no tienes

						complex = false para saludos, definiciones y dudas puntuales.

						---

						QUERIES:
						- solo si needsResearch = true
						- 2 a 3 en inglés

						---

						ANSWER:
						- siempre obligatorio
						- español
						- 2 a 5 líneas, simple primero
						- si needsResearch=true → respuesta general sin inventar detalles

						---

						NO texto adicional. Solo JSON válido.
						Ejemplos:
						- "hola" → { "needsResearch": false, "complex": false, "queries": [], "answer": "¡Hola! Soy Pingou, ¿en qué te puedo ayudar con programación?" }
						- "qué es bun" → { "needsResearch": true, "complex": false, "queries": ["bun javascript runtime", "bun.sh what is"], "answer": "Bun es un runtime alternativo a Node, pero dejame buscar info actualizada para darte detalles..." }
						- "qué es una variable" → { "needsResearch": false, "complex": false, "queries": [], "answer": "Una variable es un espacio en memoria con un nombre, donde guardás un valor que puede cambiar. Ej: \`let x = 5\`. ¿Querés que profundice?" }
						- "mi useEffect entra en un loop infinito cuando actualizo el estado, ¿cómo lo arreglo?" → { "needsResearch": false, "complex": true, "queries": [], "answer": "Pasa porque el efecto actualiza un estado que está en sus dependencias. Revisá el array de dependencias del useEffect." }`,
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
			return fallback("Ocurrió un error al procesar tu pregunta.");
		}
	}

	/**
	 * MEGA-CALL #2: dado una pregunta y las fuentes scrapeadas en crudo
	 * (markdown), produce el answer final con citas [N] inline. El modelo
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

ADEMÁS, recibís en el siguiente turno fuentes de internet numeradas (markdown crudo scrapeado). Reglas extra para esta respuesta:

1. CITAS INLINE: cada afirmación que tomes de una fuente la citás con [N] al final de la oración. [1][2] cuando combinás varias.
2. SIN FUENTE = DECILO: si una afirmación no está respaldada por las fuentes, marcala con "(según mi conocimiento general)" en lugar de presentarla como hecho.
3. OPINIÓN CONCRETA: si las fuentes permiten una recomendación específica, dala. Mejor opinada y útil que vaga.
4. CONTRADICCIONES: si las fuentes se contradicen, decilo explícitamente.
5. IGNORÁ NOISE: las fuentes incluyen nav, ads, "subscribe", footers, related posts. Extraé solo lo relevante a la pregunta y descartá el resto.

Las reglas anteriores de Pingou (versión simple primero, español amigable, seguridad/moderación) siguen aplicando.`,
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
					? "Estoy saturado por el momento (límite de uso alcanzado). Por favor, intentá de nuevo en unos minutos. 🔄"
					: "Ocurrió un error al sintetizar la respuesta. Por favor, intentá más tarde.",
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
			// Cuando hay contexto web lo inyectamos como un turno previo y le
			// agregamos un "writer prompt" estilo Perplexica que obliga al modelo
			// a citar con [N] inline y a ser explícito cuando las fuentes no
			// alcanzan. Las fuentes vienen ya numeradas desde webResearch.ts
			// como "Fuente 1: URL ...", así que el modelo solo tiene que usar
			// el mismo número entre corchetes.
			const contextMessages: OpenAI.ChatCompletionMessageParam[] = webContext
				? [
						{
							role: "user" as const,
							content: `${webContext}

Usá el contexto de arriba para responder con mayor precisión. Reglas:

1. CITAS INLINE: cuando uses información de una fuente, cita con [N] al final de la oración (donde N es el número de la fuente). Una afirmación puede tener varias citas: [1][2]. Si combinás info de varias fuentes en un mismo punto, citá todas.

2. SIN FUENTE = DECILO: si una afirmación no está respaldada por las fuentes, marcala con "(según mi conocimiento general)" en vez de presentarla como hecho recuperado.

3. OPINIÓN CONCRETA: no te quedes en generalidades. Si las fuentes permiten una recomendación o conclusión específica, dala. Mejor una respuesta opinada y útil que un resumen vago.

4. CONTRADICCIONES: si las fuentes se contradicen, mencionalo explícitamente en lugar de elegir una al azar.`,
						},
						{
							role: "assistant" as const,
							content:
								"Entendido. Voy a citar con [N] inline cada vez que use una fuente, marcar lo no respaldado, ser específico, y señalar contradicciones si las hay.",
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
					text: "Estoy saturado por el momento (límite de uso alcanzado). Por favor, intentá de nuevo en unos minutos. 🔄",
				};
			}

			return {
				text: "Ocurrió un error al procesar tu pregunta. Por favor, intentá más tarde.",
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
				{ role: "system" as const, content: BOT_PROMPT },
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
				text: "Ocurrió un error al procesar los adjuntos. Por favor, intentá más tarde.",
			};
		}
	}
}

export const aiService = new AIService();
