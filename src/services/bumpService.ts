import { ActionRow, Button, type Message, type UsingClient } from "seyfert";
import { ButtonStyle } from "seyfert/lib/types";
import { CONFIG } from "@/config";
import { JobType } from "@/database/schemas/schedules";
import {
	bumpRepository,
	type LastBumpType,
} from "@/repositories/bumpRepository";
import { Embeds, hasEmbed } from "@/utils/embeds";
import { schedulerService } from "./scheduler";

const JOB_TYPE = JobType.BumpReminder;
const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 horas
const BUMP_ROLE_NAME = "Recuerdame bumpear";
export const BUMP_BUTTON_ID = "bump-role-toggle";

let cachedRoleId: string | null = null;

schedulerService.register(
	JOB_TYPE,
	async (client: UsingClient, _userId: string) => {
		if (!CONFIG.CHANNELS.BUMP) return;

		const roleId = await bumpService.ensureBumpRole(client).catch(() => null);
		const mention = roleId ? `<@&${roleId}> ` : "";

		await client.messages
			.write(CONFIG.CHANNELS.BUMP, {
				content: mention,
				embeds: [
					Embeds.successEmbed(
						"¡Ya se puede volver a bumpear!",
						`Usá </bump:947088344167366698> para ganar pyecoins.`,
						// NOTE: no se que tan viable sea esto, la ID puede cambiar.
					),
				],
				allowed_mentions: roleId ? { roles: [roleId] } : undefined,
			})
			.catch(console.error);
	},
);

export class BumpService {
	public async addBump(userId: string): Promise<void> {
		await bumpRepository.upsert(userId);
	}

	public async getLastBump(userId?: string): Promise<LastBumpType | undefined> {
		return await bumpRepository.findLastBump(userId);
	}

	public async scheduleReminder(
		client: UsingClient,
		userId: string,
	): Promise<void> {
		await schedulerService.schedule(client, JOB_TYPE, userId, COOLDOWN_MS);
	}

	public async ensureBumpRole(client: UsingClient): Promise<string | null> {
		if (cachedRoleId) return cachedRoleId;

		const guildId = CONFIG.GUILD_ID;
		if (!guildId) return null;

		const roles = await client.roles.list(guildId, true);
		const existing = roles.find((r) => r.name === BUMP_ROLE_NAME);

		if (existing) {
			cachedRoleId = existing.id;
			return cachedRoleId;
		}

		await client.messages.write(guildId, {
			content: BUMP_ROLE_NAME,
		});

		const created = await client.roles.create(
			guildId,
			{
				name: BUMP_ROLE_NAME,
			},
			"Rol para recordatorios de bump",
		);

		cachedRoleId = created.id;
		return cachedRoleId;
	}

	public async handleBump(message: Message): Promise<void> {
		const isSuccess =
			hasEmbed(message.embeds) &&
			message.embeds[0].description?.includes("Bump done!");
		if (!isSuccess) return;

		const userId = message.interactionMetadata?.user.id;
		if (!userId) return;

		await this.addBump(userId);
		await this.scheduleReminder(message.client, userId);

		const button = new Button()
			.setCustomId(BUMP_BUTTON_ID)
			.setLabel("Recuérdame bumpear")
			.setStyle(ButtonStyle.Primary);

		const row = new ActionRow<Button>().setComponents([button]);

		await message.client.messages
			.write(message.channelId, { components: [row] })
			.catch(console.error);
	}
}

export const bumpService = new BumpService();
