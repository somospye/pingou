export type TemplatePrimitive = string | number | boolean | undefined | null;

export function cleanString(
	strings: TemplateStringsArray,
	...values: TemplatePrimitive[]
): string {
	return strings
		.reduce((result, str, i) => result + str + (values[i] ?? ""), "")
		.replace(/\n\s+/g, "\n")
		.trim();
}

export function truncate(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
