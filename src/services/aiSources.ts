/**
 * Store en memoria de fuentes consultadas por respuesta IA, accesible por
 * un key corto (UUID-prefix). Se usa para que el botón "📚 Ver fuentes" del
 * embed pueda recuperar las URLs sin tener que codificarlas en el customId
 * (limit Discord = 100 chars).
 *
 * TTL de 1h — si el usuario hace clic mucho después la respuesta del botón
 * dice que expiraron. Cleanup oportunista en cada save() para que el Map
 * no crezca sin límite. No persiste en DB porque las fuentes son inherentes
 * a la conversación reciente y se pierden al reboot del bot por diseño.
 */
class AISourcesStore {
	private readonly store = new Map<
		string,
		{ urls: string[]; expiresAt: number }
	>();
	private readonly TTL_MS = 60 * 60 * 1000; // 1h

	save(key: string, urls: string[]): void {
		this.store.set(key, {
			urls,
			expiresAt: Date.now() + this.TTL_MS,
		});
		this.cleanupExpired();
	}

	get(key: string): string[] | null {
		const entry = this.store.get(key);
		if (!entry) return null;
		if (entry.expiresAt < Date.now()) {
			this.store.delete(key);
			return null;
		}
		return entry.urls;
	}

	private cleanupExpired(): void {
		const now = Date.now();
		for (const [k, v] of this.store) {
			if (v.expiresAt < now) this.store.delete(k);
		}
	}
}

export const aiSourcesStore = new AISourcesStore();
