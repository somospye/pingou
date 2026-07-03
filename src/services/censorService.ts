import { existsSync, readFileSync, writeFileSync } from "fs";
import type { Message, UsingClient } from "seyfert";

const CENSOR_WORDS_PATH = process.env.CENSOR_WORDS_PATH ?? "./censorWords.json";

const WEBHOOK_NAME = "Pingou";

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
	private _words: string[] = [];

	constructor() {
		this.loadWords();
	}

	private loadWords(): void {
		if (!existsSync(CENSOR_WORDS_PATH)) {
			this._words = [];
			this._pattern = null;
			return;
		}
		try {
			const data = readFileSync(CENSOR_WORDS_PATH, "utf-8");
			this._words = JSON.parse(data) as string[];
			this._pattern = null;
		} catch (err) {
			console.error("Failed to load censor words:", err);
			this._words = [];
			this._pattern = null;
		}
	}

	private saveWords(): void {
		writeFileSync(
			CENSOR_WORDS_PATH,
			JSON.stringify(this._words, null, 2),
			"utf-8",
		);
	}

	get words(): readonly string[] {
		return this._words;
	}

	private get pattern(): RegExp | null {
		if (!this._words.length) return null;
		if (!this._pattern) {
			const alternatives = this._words.map(escapeRegExp).join("|");
			this._pattern = new RegExp(`\\b(?:${alternatives})\\b`, "g");
		}
		return this._pattern;
	}

	censor(content: string): string | null {
		const pattern = this.pattern;
		if (!pattern || !content) return null;

		const { normalized, indexMap } = buildNormalized(content);
		const matches = [...normalized.matchAll(pattern)];
		if (!matches.length) return null;

		let censored = content;
		for (const match of matches.reverse()) {
			const start = indexMap[match.index];
			const last = indexMap[match.index + match[0].length - 1];
			if (start === undefined || last === undefined) continue;
			const wordLen = last + 1 - start;
			if (wordLen <= 2) {
				censored =
					censored.slice(0, start) +
					"\\*".repeat(wordLen) +
					censored.slice(last + 1);
			} else {
				censored =
					censored.slice(0, start) +
					censored.charAt(start) +
					"\\*".repeat(wordLen - 2) +
					censored.charAt(last) +
					censored.slice(last + 1);
			}
		}
		return censored;
	}

	async addWord(word: string): Promise<boolean> {
		const lower = word.toLowerCase();
		if (this._words.some((w) => w.toLowerCase() === lower)) return false;
		this._words.push(word);
		this._pattern = null;
		this.saveWords();
		return true;
	}

	async repostAsUser(message: Message, content: string): Promise<void> {
		const client = message.client;
		const channel = await client.channels.fetch(message.channelId);
		const isThread = channel.isThread();

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
