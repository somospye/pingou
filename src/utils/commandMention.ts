import type { UsingClient } from "seyfert";

const cache = new Map<string, string>();

/**
 * Devuelve la mención de un slash command (`</nombre:id>`), que en Discord
 * se ve como un link que abre el comando. Busca el id una sola vez y lo
 * guarda; si no lo encuentra devuelve `/nombre` como texto.
 */
export async function commandMention(
	client: UsingClient,
	name: string,
): Promise<string> {
	const cached = cache.get(name);
	if (cached) return cached;

	try {
		const commands = await client.proxy
			.applications(client.applicationId)
			.commands.get();
		for (const cmd of commands) cache.set(cmd.name, `</${cmd.name}:${cmd.id}>`);
	} catch (err) {
		console.error("Failed to fetch application commands:", err);
	}

	return cache.get(name) ?? `/${name}`;
}
