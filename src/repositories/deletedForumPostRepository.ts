import { db } from "@/database";
import { deletedForumPosts } from "@/database/schemas/deletedForumPosts";

export type NewDeletedForumPost = typeof deletedForumPosts.$inferInsert;

export class DeletedForumPostRepository {
	public async create(post: NewDeletedForumPost) {
		return await db.insert(deletedForumPosts).values(post);
	}
}

export const deletedForumPostRepository = new DeletedForumPostRepository();
