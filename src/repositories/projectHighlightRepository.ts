import { eq } from "drizzle-orm";
import { db } from "@/database";
import { projectHighlights } from "@/database/schemas/projectHighlights";

export class ProjectHighlightRepository {
	/** Inserts the thread. Returns false when it was already highlighted. */
	async claim(threadId: string): Promise<boolean> {
		const rows = await db
			.insert(projectHighlights)
			.values({ threadId })
			.onConflictDoNothing()
			.returning();
		return !!rows.length;
	}

	async release(threadId: string) {
		return await db
			.delete(projectHighlights)
			.where(eq(projectHighlights.threadId, threadId));
	}
}

export const projectHighlightRepository = new ProjectHighlightRepository();
