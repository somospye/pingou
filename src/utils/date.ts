export type Period = "weekly" | "monthly" | "all";

/**
 * Calcula la fecha de inicio de un periodo (semanal o mensual).
 * - Weekly: 7 días exactos hacia atrás.
 * - Monthly: El mismo día del mes anterior (UTC).
 */
export function getPeriodStart(period: Period): Date {
	const now = new Date();
	if (period === "weekly") {
		return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	}
	if (period === "monthly") {
		const d = new Date(now);
		d.setUTCMonth(d.getUTCMonth() - 1);
		return d;
	}
	// "all" o fallback
	return new Date(0);
}
