export type Complexity = "simple" | "complex";

const STACK_TRACE =
	/(Traceback \(most recent call last\)|^\s*at .+[(:]\d+(:\d+)?\)?$|\b\w*(Error|Exception)\b:|\bline \d+\b|exit code \d+|segmentation fault|panic:)/im;

// Pedidos que suelen necesitar razonamiento largo o comparar opciones
const HEAVY_REQUEST =
	/(paso a paso|a fondo|en detalle|compar(a|ar|ación|aciones)|diferencias? entre .+ y |pros y contras|ventajas y desventajas|arquitectura|diseñ(a|ar|o)|optimiz|refactoriz|escalab|rendimiento|algoritmo|complejidad|por ?qu[eé] no funciona|no me funciona|revis(a|ar) (mi|este|el) código|debug|depur|implement(a|ar|o)|mejores? pr[aá]cticas|patr[oó]n(es)? de diseño)/i;

const GREETING =
	/^(hola+|holi+|buenas?|buen d[ií]a|hey|ey|gracias|muchas gracias|ty|thx|ok|okey|vale|dale|jaja+|xd+|bien|perfecto|genial)\b[\s!?.]*$/i;

// Instalar, configurar o desplegar casi siempre necesita pasos y código
const SETUP_REQUEST =
	/\b(instal|configur|despli?eg|deploy|integr|conect|migr|dockeriz|levant(o|ar) (un|el|mi))/i;

const CODE_HINT =
	/[{}();=<>]|=>|\b(function|const|let|def|class|import|return)\b/;
const ERROR_WORDS = /\b(error|bug|falla|crash|no funciona|excepci[oó]n)\b/i;

/**
 * Estimación rápida y sin IA de qué tan pesada es una pregunta. Devuelve
 * "complex" o "simple" cuando es claro, y null cuando conviene que decida
 * el planner (Lightning).
 */
export function estimateComplexity(text: string): Complexity | null {
	const t = text.trim();
	if (!t) return null;

	const codeLines = t.split("\n").filter((line) => CODE_HINT.test(line)).length;
	const questions = (t.match(/\?/g) ?? []).length;

	if (
		t.includes("```") ||
		codeLines >= 3 ||
		STACK_TRACE.test(t) ||
		t.length > 350 ||
		(questions >= 2 && t.length > 120) ||
		(ERROR_WORDS.test(t) && t.length > 80) ||
		HEAVY_REQUEST.test(t)
	) {
		return "complex";
	}

	if (
		GREETING.test(t) ||
		(t.length <= 45 &&
			!CODE_HINT.test(t) &&
			!ERROR_WORDS.test(t) &&
			!SETUP_REQUEST.test(t))
	) {
		return "simple";
	}

	return null;
}
