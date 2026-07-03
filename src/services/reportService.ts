import type { UsingClient } from "seyfert";
import { CONFIG } from "@/config";
import { Embeds } from "@/utils/embeds";

export interface ReportData {
	reporterId: string;
	reporterTag: string;
	reportedUserId: string;
	reportedTag?: string;
	reason: string;
	evidence?: string;
	messageUrl?: string;
	messageExcerpt?: string;
}

export class ReportService {
	async sendReport(client: UsingClient, data: ReportData) {
		await client.messages.write(CONFIG.CHANNELS.REPORTS, {
			embeds: [Embeds.reportEmbed(data)],
		});
	}
}

export const reportService = new ReportService();
