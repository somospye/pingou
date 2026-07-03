import { CONFIG } from "@/config";
import { economyRepository } from "@/repositories/economyRepository";

const HOUR_MS = 60 * 60 * 1000;

const WORK_JOBS = [
	"desarrollador junior",
	"tester de QA",
	"administrador de bases de datos",
	"diseñador UX",
	"técnico de soporte",
	"ingeniero DevOps",
	"freelancer de WordPress",
	"profesor de programación",
	"revisor de pull requests",
	"cazador de bugs",
] as const;

interface CooldownActive {
	ok: false;
	reason: "cooldown";
	availableAt: number;
}

export class EconomyService {
	private randomInt(min: number, max: number): number {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	// Returns the unix timestamp (seconds) when the cooldown ends, or null if
	// it is not active.
	private cooldownEnd(last: Date | null, hours: number): number | null {
		if (!last) return null;
		const end = last.getTime() + hours * HOUR_MS;
		return end > Date.now() ? Math.floor(end / 1000) : null;
	}

	private cooldownResult(availableAt: number): CooldownActive {
		return { ok: false, reason: "cooldown", availableAt };
	}

	async daily(userId: string) {
		const { MIN, MAX, COOLDOWN_HOURS } = CONFIG.ECONOMY.DAILY;
		const row = await economyRepository.findOrCreate(userId);
		const availableAt = this.cooldownEnd(row.lastDaily, COOLDOWN_HOURS);
		if (availableAt) return this.cooldownResult(availableAt);

		const amount = this.randomInt(MIN, MAX);
		const cutoff = new Date(Date.now() - COOLDOWN_HOURS * HOUR_MS);
		const updated = await economyRepository.claimDaily(userId, amount, cutoff);
		if (!updated) {
			return this.cooldownResult(
				Math.floor((Date.now() + COOLDOWN_HOURS * HOUR_MS) / 1000),
			);
		}
		return { ok: true as const, amount, balance: updated.coins };
	}

	async work(userId: string) {
		const { MIN, MAX, COOLDOWN_HOURS } = CONFIG.ECONOMY.WORK;
		const row = await economyRepository.findOrCreate(userId);
		const availableAt = this.cooldownEnd(row.lastWork, COOLDOWN_HOURS);
		if (availableAt) return this.cooldownResult(availableAt);

		const amount = this.randomInt(MIN, MAX);
		const cutoff = new Date(Date.now() - COOLDOWN_HOURS * HOUR_MS);
		const updated = await economyRepository.claimWork(userId, amount, cutoff);
		if (!updated) {
			return this.cooldownResult(
				Math.floor((Date.now() + COOLDOWN_HOURS * HOUR_MS) / 1000),
			);
		}
		const job =
			WORK_JOBS[this.randomInt(0, WORK_JOBS.length - 1)] ?? WORK_JOBS[0];
		return { ok: true as const, amount, job, balance: updated.coins };
	}

	async rob(robberId: string, targetId: string) {
		const {
			COOLDOWN_HOURS,
			SUCCESS_RATE,
			STEAL_PCT,
			MAX_STEAL,
			FINE_PCT,
			MIN_TARGET_BALANCE,
		} = CONFIG.ECONOMY.ROB;
		const robber = await economyRepository.findOrCreate(robberId);
		const availableAt = this.cooldownEnd(robber.lastRob, COOLDOWN_HOURS);
		if (availableAt) return this.cooldownResult(availableAt);

		const targetBalance = await economyRepository.getBalance(targetId);
		if (targetBalance < MIN_TARGET_BALANCE) {
			return { ok: false as const, reason: "target_too_poor" as const };
		}

		// The attempt consumes the cooldown regardless of the outcome.
		await economyRepository.setLastRob(robberId);

		if (Math.random() < SUCCESS_RATE) {
			const stolen = Math.min(Math.floor(targetBalance * STEAL_PCT), MAX_STEAL);
			const moved = await economyRepository.transfer(
				targetId,
				robberId,
				stolen,
				stolen,
			);
			// The target spent their coins between the check and the transfer.
			if (!moved)
				return { ok: false as const, reason: "target_too_poor" as const };
			return { ok: true as const, success: true as const, stolen };
		}

		// The fine is burned, not given to the target (currency sink).
		const fine = Math.floor(robber.coins * FINE_PCT);
		if (fine) await economyRepository.burn(robberId, fine);
		return { ok: true as const, success: false as const, fine };
	}

	async transfer(fromId: string, toId: string, amount: number) {
		// The tax is burned, not collected by anyone (currency sink).
		const tax = Math.floor(amount * CONFIG.ECONOMY.TRANSFER_TAX);
		const received = amount - tax;
		const moved = await economyRepository.transfer(
			fromId,
			toId,
			amount,
			received,
		);
		if (!moved) return { ok: false as const, reason: "insufficient" as const };
		return { ok: true as const, received, tax };
	}

	async balance(userId: string) {
		return await economyRepository.getBalance(userId);
	}

	async top(limit = 10) {
		return await economyRepository.getTop(limit);
	}
}

export const economyService = new EconomyService();
