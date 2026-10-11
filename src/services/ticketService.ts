import { ticketRepository } from "@/repositories/ticketRepository";

type Ticket = NonNullable<
	Awaited<ReturnType<typeof ticketRepository.findOpenByUser>>
>;

export type OpenTicketResult =
	| { created: true; ticket: Ticket | undefined }
	| { created: false; existing: Ticket };

export class TicketService {
	async getOpenTicketByUser(userId: string) {
		return await ticketRepository.findOpenByUser(userId);
	}

	async getOpenTicketByThread(threadId: string) {
		return await ticketRepository.findOpenByThread(threadId);
	}

	async openTicket(data: {
		userId: string;
		threadId: string;
		subject: string;
	}): Promise<OpenTicketResult> {
		const existing = await ticketRepository.findOpenByUser(data.userId);
		if (existing) return { created: false, existing };

		const ticket = await ticketRepository.create(data);
		return { created: true, ticket };
	}

	async closeTicket(threadId: string, closedBy: string) {
		return await ticketRepository.close(threadId, closedBy);
	}
}

export const ticketService = new TicketService();
