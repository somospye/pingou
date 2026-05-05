import {
	ActionRow,
	Button,
	type CommandContext,
	type UsingClient,
} from "seyfert";
import { ButtonStyle, MessageFlags } from "seyfert/lib/types";
import {
	type ModActionType,
	moderationService,
} from "@/services/moderationService";
import { Embeds } from "./embeds";

interface BasicUserLike {
	id: string;
	username?: string;
	avatarURL?: () => string | undefined;
}

interface DisplayUser {
	id: string;
	tag: string;
	avatar?: string;
}

interface ValidateTargetOptions {
	targetUserId: string;
	targetMember: { id: string; roles: { keys: string[] } } | null;
	requireMember: boolean;
	selfActionMessage: string;
}

type DmPayload = Parameters<UsingClient["users"]["write"]>[1];
type FallbackPayload = Parameters<UsingClient["messages"]["write"]>[1];

type LimitCheck = {
	allowed: boolean;
	limit?: number;
};

export const CASES_PER_PAGE = 6;

export function getTotalCasePages(totalCases: number): number {
	return Math.ceil(totalCases / CASES_PER_PAGE) || 1;
}

export function getCasesChunk<T>(cases: T[], page: number): T[] {
	const start = (page - 1) * CASES_PER_PAGE;
	return cases.slice(start, start + CASES_PER_PAGE);
}

export function buildCasePaginationRow(
	userId: string,
	page: number,
	totalPages: number,
) {
	return new ActionRow<Button>().addComponents(
		new Button()
			.setCustomId(`case-prev_${userId}_${page}`)
			.setLabel("Anterior")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === 1),
		new Button()
			.setCustomId(`case-next_${userId}_${page}`)
			.setLabel("Siguiente")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === totalPages),
	);
}

export function hasModerationPriority(
	moderatorRoles: string[],
	targetRoles: string[],
): boolean {
	const moderatorWeight = moderationService.getTierWeight(moderatorRoles);
	const targetWeight = moderationService.getTierWeight(targetRoles);
	return !(targetWeight >= moderatorWeight && moderatorWeight < 3);
}

export async function replyModerationLimit(
	ctx: CommandContext,
	actionType: ModActionType,
	check: LimitCheck,
) {
	if (check.allowed) return true;

	await ctx.editOrReply({
		embeds: [
			check.limit === 0
				? Embeds.noPermissionsEmbed()
				: Embeds.rateLimitEmbed(actionType, check.limit ?? 0),
		],
		flags: MessageFlags.Ephemeral,
	});
	return false;
}

export async function notifyWithFallback(
	client: UsingClient,
	data: {
		userId: string;
		dmPayload: DmPayload;
		fallbackPayload: FallbackPayload;
		fallbackChannelId?: string;
	},
) {
	try {
		await client.users.write(data.userId, data.dmPayload);
	} catch {
		if (data.fallbackChannelId) {
			await client.messages.write(data.fallbackChannelId, data.fallbackPayload);
		}
	}
}

export async function replyModerationError(
	ctx: CommandContext,
	message: string,
) {
	await ctx.editOrReply({
		embeds: [Embeds.errorEmbed("Error", message)],
		flags: MessageFlags.Ephemeral,
	});
}

export async function validateModerationLimit(
	ctx: CommandContext,
	actionType: ModActionType,
) {
	const moderatorRoles = ctx.member?.roles.keys ?? [];
	const check = await moderationService.checkLimit(
		ctx.author.id,
		moderatorRoles,
		actionType,
	);
	return await replyModerationLimit(ctx, actionType, check);
}

export async function fetchTargetMember(
	ctx: CommandContext,
	guildId: string,
	targetUserId: string,
) {
	return await ctx.client.members
		.fetch(guildId, targetUserId)
		.catch(() => null);
}

export async function validateModerationTarget(
	ctx: CommandContext,
	options: ValidateTargetOptions,
) {
	const { targetUserId, targetMember, requireMember, selfActionMessage } =
		options;

	if (requireMember && !targetMember) {
		await replyModerationError(
			ctx,
			"No se pudo encontrar al usuario en el servidor.",
		);
		return false;
	}

	if (targetUserId === ctx.author.id) {
		await replyModerationError(ctx, selfActionMessage);
		return false;
	}

	if (targetMember) {
		const moderatorRoles = ctx.member?.roles.keys ?? [];
		if (!hasModerationPriority(moderatorRoles, targetMember.roles.keys)) {
			await replyModerationError(
				ctx,
				"No puedes sancionar a alguien de igual o mayor rango.",
			);
			return false;
		}
	}

	return true;
}

export function buildDisplayUser(user: BasicUserLike): DisplayUser {
	return {
		id: user.id,
		tag: user.username ?? "Usuario Desconocido",
		avatar: user.avatarURL?.(),
	};
}

export async function fetchDisplayUser(
	client: UsingClient,
	userId: string,
): Promise<DisplayUser> {
	const user = await client.users.fetch(userId).catch(() => null);
	if (!user) {
		return { id: userId, tag: "Usuario Desconocido" };
	}

	return buildDisplayUser(user);
}
