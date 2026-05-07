import {
	type GenerateContentResponseUsageMetadata,
	GoogleGenAI,
	HarmBlockThreshold,
	HarmCategory,
	Modality,
	type SafetySetting,
} from "@google/genai";
import type { UsingClient } from "seyfert";

export const SAFETY_SETTINGS: SafetySetting[] = [
	{
		category: HarmCategory.HARM_CATEGORY_HARASSMENT,
		threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
	},
	{
		category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
		threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
	},
	{
		category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
		threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
	},
	{
		category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
		threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
	},
	{
		category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
		threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
	},
];

export const BOT_PROMPT = `
	Eres Pingou (${process.env.CLIENT_ID}), el asistente oficial de la comunidad "Programadores y Estudiantes (PyE)" en Discord.

	Tu objetivo es explicar conceptos de programación de manera **muy breve y clara**, mostrando primero la versión simple y ofreciendo detalles solo si el usuario los pide.

	Reglas:

	1. **Versión simple primero (2-5 líneas máximo):**
	- Explica de manera directa y fácil de entender.
	- Incluye ejemplos mínimos solo si ayudan a comprender.

	2. **Detalle opcional:**
	- Solo si el usuario lo solicita.
	- Explica más a fondo, con ejemplos de código funcional y buenas prácticas.
	- Mantén el texto estructurado y claro.

	3. **Ejemplos de código:**
	- Siempre funcionales y fáciles de copiar.
	- Explica brevemente cada línea solo si es necesario.

	4. **Tono y estilo:**
	- Español, amigable y cercano.
	- Motiva y refuerza la confianza del usuario.

	Actúa como un asistente confiable, paciente y accesible, enfocado en que los miembros de PyE aprendan conceptos de programación de manera rápida y sencilla.
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
	private readonly memory = new Map<string, string[]>();
	private readonly ai: GoogleGenAI;
	private readonly model: string = "gemma-3-27b-it";

	constructor() {
		this.ai = new GoogleGenAI({ apiKey: process.env.AI_API_KEY });
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

	saveToMemory(id: string, messages: string[]) {
		this.memory.set(id, messages);
	}

	getFromMemory(id: string) {
		return this.memory.get(id);
	}

	async chat(
		messages: string[],
	): Promise<{ text: string; usage?: GenerateContentResponseUsageMetadata }> {
		if (!this.model) {
			throw new Error("Missing AI_API_KEY env variable");
		}

		try {
			const result = await this.ai.models.generateContent({
				model: this.model,
				config: {
					safetySettings: SAFETY_SETTINGS,
					candidateCount: 1,
					maxOutputTokens: 800,
					temperature: 0.68,
					topK: 35,
					topP: 0.77,
					responseModalities: [Modality.TEXT],
				},
				contents: [
					{
						role: "model",
						parts: [{ text: BOT_PROMPT }],
					},
					{
						role: "user",
						parts: messages.map((m) => ({ text: m })),
					},
				],
			});

			return {
				text: result.text || "Ahora no puedo responder a esta pregunta.",
				usage: result.usageMetadata,
			};
		} catch (error: any) {
			console.error("Gemini API error:", error);

			const errorStr = JSON.stringify(error);
			const isRateLimit =
				error?.status === 429 ||
				errorStr.includes("RESOURCE_EXHAUSTED") ||
				errorStr.includes("rate limit") ||
				errorStr.includes("quota exceeded");

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
