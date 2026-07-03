import {
	deletedForumPostRepository,
	type NewDeletedForumPost,
} from "@/repositories/deletedForumPostRepository";

export class DeletedForumPostService {
	public async record(post: NewDeletedForumPost): Promise<void> {
		await deletedForumPostRepository.create(post);
	}
}

export const deletedForumPostService = new DeletedForumPostService();
