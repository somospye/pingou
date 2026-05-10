import { CONFIG } from "@/config";

export interface ResearchResult {
	/** Las fuentes con su markdown crudo, listas para synthesizeAnswer */
	sources: { url: string; content: string }[];
	/** Bloque pre-armado por compatibilidad con flujos legacy (chat con webContext) */
	contextForAI: string;
	sourceUrl: string;
	sourceUrls?: string[];
}

class WebResearchService {
	private readonly JINA_BASE = "https://r.jina.ai/";
	private readonly FETCH_TIMEOUT_MS = 8_000;
	// Cap de fuentes finales que pasan al synthesize. El modelo recibe el
	// markdown crudo y filtra noise en su única llamada.
	private readonly MAX_SOURCES = 3;
	// Cuánto markdown bruto traer por URL desde Jina Reader. El synthesize
	// lo recibe entero — qwen3-coder-480b tiene context window amplísimo.
	private readonly FETCH_MAX_CHARS = 8_000;

	private async fetchWithTimeout(
		url: string,
		init?: RequestInit,
	): Promise<Response | null> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT_MS);
		try {
			return await fetch(url, { ...init, signal: controller.signal });
		} catch {
			return null;
		} finally {
			clearTimeout(timer);
		}
	}

	/**
	 * Busca en DuckDuckGo Lite usando Jina Reader como intermediario.
	 * DDG Lite codifica las URLs destino como `uddg=URL_ENCODED` en los
	 * hrefs de los resultados — los parseamos y decodificamos directamente.
	 */
	private async searchDDGLite(
		query: string,
		maxUrls = 3,
	): Promise<{ urls: string[] } | null> {
		const ddgUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
		const response = await this.fetchWithTimeout(`${this.JINA_BASE}${ddgUrl}`, {
			headers: { Accept: "text/plain" },
		});
		if (!response?.ok) return null;

		try {
			const text = await response.text();
			if (!text.trim()) return null;

			const urls = [...text.matchAll(/uddg=([^&\s")\]]+)/g)]
				.map((m) => {
					const raw = m[1];
					if (!raw) return null;
					try {
						return decodeURIComponent(raw);
					} catch {
						return null;
					}
				})
				.filter(
					(u): u is string =>
						!!u && u.startsWith("http") && !u.includes("duckduckgo.com"),
				)
				.slice(0, maxUrls);

			return { urls };
		} catch {
			return null;
		}
	}

	/**
	 * Lee una URL con Jina Reader y devuelve su contenido como markdown.
	 */
	private async fetchMarkdown(
		url: string,
		maxChars: number,
	): Promise<string | null> {
		const response = await this.fetchWithTimeout(`${this.JINA_BASE}${url}`, {
			headers: { Accept: "text/markdown, text/plain" },
		});
		if (!response?.ok) return null;
		try {
			return (await response.text()).slice(0, maxChars);
		} catch {
			return null;
		}
	}

	/**
	 * Ranking heurístico de URLs por reputación de dominio + señales de
	 * spam/junk. Reemplaza al LLM picker para ahorrar llamadas al modelo
	 * (rate limit del provider). Las reglas (regex + score) viven en
	 * `CONFIG.AI.URL_RANKING` para poder ajustarlas sin tocar el código.
	 *
	 * Los scores son acumulativos: cada regex que matchea suma su score
	 * al total para esa URL.
	 */
	private rankUrlsByReputation(urls: string[]): string[] {
		const score = (url: string): number => {
			const u = url.toLowerCase();
			return CONFIG.AI.URL_RANKING.reduce(
				(s, rule) => (rule.pattern.test(u) ? s + rule.score : s),
				0,
			);
		};
		return [...urls].sort((a, b) => score(b) - score(a));
	}

	/**
	 * Investigación web paralela y stateless. Toma las queries pre-generadas,
	 * busca todas en paralelo en DDG Lite, junta los candidatos URL, rankea
	 * por reputación de dominio, toma los top MAX_SOURCES (deduplicados) y
	 * fetchea su markdown en paralelo. Devuelve las fuentes crudas — el
	 * synthesize del aiService hace la extracción y síntesis en su única
	 * call.
	 *
	 * Cero llamadas al LLM dentro de este servicio. Reemplaza al loop
	 * adaptativo anterior que hacía 1 picker + 1 extract por fuente +
	 * 1 eval por ronda. El nuevo flow vive en aiService.planResponse +
	 * aiService.synthesizeAnswer (2 calls totales).
	 */
	async researchMultiple(
		_query: string,
		initialQueries: string[],
		onProgress?: (description: string) => Promise<void>,
	): Promise<ResearchResult | null> {
		if (!initialQueries.length) return null;

		await onProgress?.(
			`🔍 Buscando: ${initialQueries.map((q) => `\`${q}\``).join(", ")}`,
		);

		// 1. SERP en paralelo para todas las queries
		const serpResults = await Promise.all(
			initialQueries.map((q) => this.searchDDGLite(q, 5)),
		);

		// 2. Junta candidatos, deduplica, rankea heurísticamente
		const allUrls = serpResults.flatMap((r) => r?.urls ?? []);
		const uniqueUrls = [...new Set(allUrls)];
		const rankedUrls = this.rankUrlsByReputation(uniqueUrls).slice(
			0,
			this.MAX_SOURCES,
		);
		if (!rankedUrls.length) return null;

		await onProgress?.(
			`📄 Leyendo ${rankedUrls.length} fuente(s) en paralelo...`,
		);

		// 3. Fetch markdown de las top fuentes en paralelo
		const fetched = await Promise.all(
			rankedUrls.map((url) =>
				this.fetchMarkdown(url, this.FETCH_MAX_CHARS).then((content) =>
					content?.trim() ? { url, content } : null,
				),
			),
		);
		const sources = fetched.filter(
			(s): s is { url: string; content: string } => s !== null,
		);
		if (!sources.length) return null;

		await onProgress?.(
			`✅ ${sources.length} fuente(s) obtenidas, sintetizando...`,
		);

		const sourceUrls = sources.map((s) => s.url);
		const contextForAI = [
			`[Contexto de internet — ${sources.length} fuente(s): ${sourceUrls.join(", ")}]`,
			...sources.map(
				(s, i) => `--- Fuente ${i + 1}: ${s.url} ---\n${s.content}`,
			),
			"[Fin del contexto web]",
		].join("\n\n");

		return {
			contextForAI,
			sources,
			sourceUrl: sourceUrls.at(0) ?? "",
			sourceUrls,
		};
	}
}

export const webResearchService = new WebResearchService();
