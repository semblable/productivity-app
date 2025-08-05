import { db } from './db';

/**
 * Create a new folder inside a project.
 * @param {{ name: string, projectId: number, color?: string }} param0
 * @returns {Promise<number>} The newly created folder id (Dexie returns id)
 */
export const createFolder = async ({ name, projectId, parentId = null, color }) => {
  const createdAt = new Date();
  return db.folders.add({ name, projectId, parentId, color, createdAt });
};

/**
 * Rename a folder by id.
 * @param {number} id Folder id
 * @param {string} name New name
 */
export const renameFolder = (id, name) => db.folders.update(id, { name });

/**
 * Delete a folder and all its child folders recursively.
 * If cascade is true, also delete all tasks that belong to the folder and its children.
 * Otherwise, move tasks to Ungrouped by setting folderId = null.
 * @param {number} id Folder id to delete
 * @param {{ cascade?: boolean }} opts Options
 */
export const deleteFolder = async (id, { cascade = false } = {}) => {
  await db.transaction('rw', db.tasks, db.folders, async () => {
    // Get all child folders recursively
    const getAllChildFolders = async (parentId) => {
      const children = await db.folders.where({ parentId }).toArray();
      let allChildren = [...children];
      
      for (const child of children) {
        const grandChildren = await getAllChildFolders(child.id);
        allChildren = allChildren.concat(grandChildren);
      }
      
      return allChildren;
    };
    
    const childFolders = await getAllChildFolders(id);
    const allFolderIds = [id, ...childFolders.map(f => f.id)];
    
    if (cascade) {
      // Delete all tasks within the folder hierarchy
      for (const folderId of allFolderIds) {
        await db.tasks.where({ folderId }).delete();
      }
    } else {
      // Move all tasks to Ungrouped (folderId = null)
      for (const folderId of allFolderIds) {
        await db.tasks.where({ folderId }).modify({ folderId: null });
      }
    }
    
    // Delete all folders in the hierarchy
    await db.folders.bulkDelete(allFolderIds);
  });
};

/**
 * Hook-friendly query to get folders for a given project using Dexie liveQuery.
 * @param {number} projectId
 */
export const getFoldersForProject = (projectId) =>
  db.folders.where({ projectId }).toArray();
