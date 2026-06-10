import type { Message, UsingClient } from "seyfert";
import { CONFIG } from "@/config";

const WEBHOOK_NAME = "Pingou";

// Basic leet substitutions applied during normalization
const LEET_CHARS: Record<string, string> = {
	"0": "o",
	"1": "i",
	"3": "e",
	"4": "a",
	"5": "s",
	"7": "t",
};

interface ChannelWebhook {
	id: string;
	token: string;
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a normalized copy of the text (lowercase, accents stripped, leet
 * mapped) keeping an index map back to the original string, so matches on
 * the normalized text can be censored over the original one.
 */
function buildNormalized(text: string): {
	normalized: string;
	indexMap: number[];
} {
	let normalized = "";
	const indexMap: number[] = [];
	for (let i = 0; i < text.length; i++) {
		const stripped = text
			.charAt(i)
			.toLowerCase()
			.normalize("NFD")
			.replace(/[̀-ͯ]/g, "");
		const mapped = LEET_CHARS[stripped] ?? stripped;
		for (const char of mapped) {
			normalized += char;
			indexMap.push(i);
		}
	}
	return { normalized, indexMap };
}

export class CensorService {
	private webhookCache = new Map<string, ChannelWebhook>();
	private _pattern: RegExp | null = null;

	private get pattern(): RegExp | null {
		if (!CONFIG.CENSOR.WORDS.length) return null;
		if (!this._pattern) {
			const alternatives = CONFIG.CENSOR.WORDS.map(escapeRegExp).join("|");
			this._pattern = new RegExp(`\\b(?:${alternatives})\\b`, "g");
		}
		return this._pattern;
	}

	/**
	 * Returns the content with every blacklisted word replaced by
	 * backslash-escaped asterisks of the same length, or null when the
	 * content has no blacklisted words.
	 */
	censor(content: string): string | null {
		const pattern = this.pattern;
		if (!pattern || !content) return null;

		const { normalized, indexMap } = buildNormalized(content);
		const matches = [...normalized.matchAll(pattern)];
		if (!matches.length) return null;

		let censored = content;
		// Replace from the end so earlier indices stay valid
		for (const match of matches.reverse()) {
			const start = indexMap[match.index];
			const last = indexMap[match.index + match[0].length - 1];
			if (start === undefined || last === undefined) continue;
			censored =
				censored.slice(0, start) +
				"\\*".repeat(last + 1 - start) +
				censored.slice(last + 1);
		}
		return censored;
	}

	/** Reposts the censored content impersonating the original author. */
	async repostAsUser(message: Message, content: string): Promise<void> {
		const client = message.client;
		const channel = await client.channels.fetch(message.channelId);
		const isThread = channel.isThread();

		// Webhooks cannot be created on threads: use the parent channel one
		// executed with the thread_id query param
		const webhookChannelId = isThread ? channel.parentId : message.channelId;
		if (!webhookChannelId)
			throw new Error(`Thread ${message.channelId} has no parent channel`);

		const webhook = await this.getChannelWebhook(client, webhookChannelId);
		await client.webhooks.writeMessage(webhook.id, webhook.token, {
			body: {
				content,
				username: message.member?.displayName ?? message.author.username,
				avatar_url: message.member?.avatarURL() ?? message.author.avatarURL(),
				allowed_mentions: { parse: [] },
			},
			query: isThread ? { thread_id: message.channelId } : undefined,
		});
	}

	private async getChannelWebhook(
		client: UsingClient,
		channelId: string,
	): Promise<ChannelWebhook> {
		const cached = this.webhookCache.get(channelId);
		if (cached) return cached;

		const existing = (await client.webhooks.listFromChannel(channelId)).find(
			(hook) => hook.name === WEBHOOK_NAME && hook.token,
		);
		const webhook =
			existing ??
			(await client.webhooks.create(channelId, { name: WEBHOOK_NAME }));
		if (!webhook.token)
			throw new Error(`Webhook for channel ${channelId} has no token`);

		const entry = { id: webhook.id, token: webhook.token };
		this.webhookCache.set(channelId, entry);
		return entry;
	}
}

export const censorService = new CensorService();
