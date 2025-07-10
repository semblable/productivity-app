import { db } from './db';

/**
 * Recursively add a tree of tasks to Dexie in a single transaction.
 * Each node should have shape: { text: string, children?: array }
 * @param {Array} tree Root tasks array
 * @param {number} projectId Project to assign to tasks
 */
export const bulkAddTasks = async (tree = [], projectId) => {
  if (!Array.isArray(tree) || tree.length === 0) return;

  await db.transaction('rw', db.tasks, async () => {
    const addNode = async (node, parentId = null) => {
      const id = await db.tasks.add({
        text: node.text || '',
        projectId,
        parentId,
        completed: false,
        createdAt: new Date(),
      });
      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          await addNode(child, id);
        }
      }
    };

    for (const root of tree) {
      await addNode(root, null);
    }
  });
}; 