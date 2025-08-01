import { db } from './db';

/**
 * Create a new folder inside a project.
 * @param {{ name: string, projectId: number, color?: string }} param0
 * @returns {Promise<number>} The newly created folder id (Dexie returns id)
 */
export const createFolder = async ({ name, projectId, color }) => {
  const createdAt = new Date();
  return db.folders.add({ name, projectId, color, createdAt });
};

/**
 * Rename a folder by id.
 * @param {number} id Folder id
 * @param {string} name New name
 */
export const renameFolder = (id, name) => db.folders.update(id, { name });

/**
 * Delete a folder.
 * If cascade is true, also delete all tasks that belong to the folder.
 * Otherwise, move tasks to Ungrouped by setting folderId = null.
 * @param {number} id Folder id to delete
 * @param {{ cascade?: boolean }} opts Options
 */
export const deleteFolder = async (id, { cascade = false } = {}) => {
  if (cascade) {
    // Delete all tasks within the folder then remove folder row
    await db.transaction('rw', db.tasks, db.folders, async () => {
      await db.tasks.where({ folderId: id }).delete();
      await db.folders.delete(id);
    });
  } else {
    // Move tasks to Ungrouped (folderId = null)
    await db.transaction('rw', db.tasks, db.folders, async () => {
      await db.tasks.where({ folderId: id }).modify({ folderId: null });
      await db.folders.delete(id);
    });
  }
};

/**
 * Hook-friendly query to get folders for a given project using Dexie liveQuery.
 * @param {number} projectId
 */
export const getFoldersForProject = (projectId) =>
  db.folders.where({ projectId }).toArray();
