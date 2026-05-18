import OpenAI from "openai";
import type { UsingClient } from "seyfert";

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

	5. **Formato (Discord embed):**
	- Tu respuesta se renderiza dentro de un **embed de Discord**, no en una página web. Usá ÚNICAMENTE markdown que Discord soporta:
		- \`**negrita**\`, \`*italica*\`, \`__subrayado__\`, \`~~tachado~~\`, \`\`código inline\`\` (con backticks simples)
		- Bloques de código con triple backtick + lenguaje: \`\`\`ts ... \`\`\`, \`\`\`py ... \`\`\`, etc.
		- Listas con \`- \` o \`1. \`. Bloque cita con \`> \`.
		- Links: \`[texto](https://url)\`.
		- Spoilers con \`||texto||\` (útil para ocultar la solución y que el usuario piense primero).
	- NO uses: tablas markdown, imágenes \`![alt](url)\`, HTML, separadores \`---\`, footnotes \`[^1]\`. Discord NO los renderiza dentro de un embed.
	- Encabezados (\`#\`, \`##\`, \`###\`) sí funcionan pero usalos sólo si el embed es largo y necesita jerarquía; para respuestas cortas omitilos.
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

export class AIService {
	private _ai: OpenAI | null = null;
	private readonly light_model: string = "mistralai/mistral-nemotron";

	// Instanciamos el cliente de forma lazy para que la falta de AI_API_KEY
	// no rompa la carga del módulo y solo falle al intentar usar la IA.
	private get ai(): OpenAI {
		if (!this._ai) {
			this._ai = new OpenAI({
				apiKey: process.env.AI_API_KEY,
				baseURL: "https://integrate.api.nvidia.com/v1",
			});
		}
		return this._ai;
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
	 */
	async planResponse(query: string): Promise<{
		needsResearch: boolean;
		queries: string[];
		answer: string;
	}> {
		const fallback = (msg: string) => ({
			needsResearch: false,
			queries: [],
			answer: msg,
		});

		if (!process.env.AI_API_KEY) {
			return fallback("La IA no está configurada por el momento.");
		}

		const truncated = query.slice(0, 600);

		try {
			const completion = await this.ai.chat.completions.create({
				model: this.light_model,
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
						- "hola" → { "needsResearch": false, "queries": [], "answer": "¡Hola! Soy Pingou, ¿en qué te puedo ayudar con programación?" }
						- "qué es bun" → { "needsResearch": true, "queries": ["bun javascript runtime", "bun.sh what is"], "answer": "Bun es un runtime alternativo a Node, pero dejame buscar info actualizada para darte detalles..." }
						- "qué es una variable" → { "needsResearch": false, "queries": [], "answer": "Una variable es un espacio en memoria con un nombre, donde guardás un valor que puede cambiar. Ej: \`let x = 5\`. ¿Querés que profundice?" }`,
					},
					{
						role: "user",
						content: truncated,
					},
				],
			});
			const raw = completion.choices[0]?.message?.content ?? "";
			const parsed = this.parseLooseJson<{
				needsResearch?: boolean;
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
			const result = await this.ai.chat.completions.create({
				model: this.light_model,
				max_tokens: 500,
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
					{
						role: "user",
						content: `Fuentes:\n\n${sourcesBlock}\n\n---\n\nPregunta: ${query}`,
					},
				],
			});

			return {
				text:
					result.choices[0]?.message?.content?.trim() ||
					"Ahora no puedo responder a esta pregunta.",
				usage: result.usage ?? undefined,
			};
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

			const result = await this.ai.chat.completions.create({
				model: this.light_model,
				max_tokens: 500,
				temperature: 0.55,
				messages: [
					{
						role: "system",
						content: BOT_PROMPT,
					},
					...contextMessages,
					...messages.map((m) => ({ role: "user" as const, content: m })),
				],
			});

			return {
				text:
					result.choices[0]?.message?.content ||
					"Ahora no puedo responder a esta pregunta.",
				usage: result.usage ?? undefined,
			};
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
}

export const aiService = new AIService();
