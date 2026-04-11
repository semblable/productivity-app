import { api } from '../api/apiClient';

/**
 * Create a new folder inside a project.
 * @param {{ name: string, projectId: number, color?: string }} param0
 * @returns {Promise<number>} The newly created folder id
 */
export const createFolder = async ({ name, projectId, parentId = null, color }) => {
  const folder = await api.folders.create({
    name,
    projectId: projectId ?? null,
    parentId: parentId ?? null,
    color,
    createdAt: new Date(),
  });
  return folder.id;
};

/**
 * Rename a folder by id.
 * @param {number} id Folder id
 * @param {string} name New name
 */
export const renameFolder = (id, name) => api.folders.update(id, { name });

/**
 * Delete a folder and all its child folders recursively.
 * If cascade is true, also delete all tasks that belong to the folder and its children.
 * Otherwise, move tasks to Ungrouped by setting folderId = null.
 * @param {number} id Folder id to delete
 * @param {{ cascade?: boolean }} opts Options
 */
export const deleteFolder = async (id, { cascade = false } = {}) => {
  if (!id) return;
  const allFolders = await api.folders.list();

  const getAllChildFolders = (parentId) => {
    const children = allFolders.filter((folder) => String(folder.parentId) === String(parentId));
    return children.flatMap((child) => [child, ...getAllChildFolders(child.id)]);
  };

  const childFolders = getAllChildFolders(id);
  const allFolderIds = [id, ...childFolders.map((folder) => folder.id)];

  for (const folderId of allFolderIds) {
    const folderTasks = await api.tasks.list({ folderId });
    if (cascade) {
      const taskIds = folderTasks.map((task) => task.id);
      if (taskIds.length > 0) {
        await api.tasks.bulkRemove(taskIds);
      }
    } else {
      await Promise.all(folderTasks.map((task) => api.tasks.update(task.id, { folderId: null })));
    }
  }

  await api.folders.bulkRemove(allFolderIds);
};

/**
 * Query to get folders for a given project.
 * @param {number} projectId
 */
export const getFoldersForProject = (projectId) =>
  api.folders.list({ projectId: projectId ?? 'null' });
