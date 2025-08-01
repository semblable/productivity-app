import { db } from './db';

/**
 * Recursively add a tree of tasks to Dexie in a single transaction.
 * Each node should have shape: { text: string, children?: array }
 * @param {Array} tree Root tasks array
 * @param {number} projectId Project to assign to tasks
 */
/**
 * Recursively add a tree of tasks to Dexie.
 * Optionally assign all tasks to a folder.
 * @param {Array} tree Hierarchical task array
 * @param {number} projectId Project id to assign tasks
 * @param {number|null} folderId Folder id to assign tasks (nullable)
 */
export const bulkAddTasks = async (tree = [], projectId, folderId = null) => {
  if (!Array.isArray(tree) || tree.length === 0) return;

  // Helper to build a sub-task object (recursively)
  const buildSubtask = (node) => {
    const id = Date.now() + Math.random(); // simple unique id for client-side use
    return {
      id,
      text: node.text || '',
      completed: false,
      subtasks: Array.isArray(node.children) ? node.children.map(buildSubtask) : [],
    };
  };

  // Convert root nodes into task rows for Dexie. Sub-tasks are embedded, not separate rows.
  const tasksToInsert = tree.map((node, idx) => ({
    text: node.text || '',
    projectId,
    folderId,
    order: idx,
    parentId: null,
    completed: false,
    createdAt: new Date(),
    subtasks: Array.isArray(node.children) ? node.children.map(buildSubtask) : [],
  }));

  await db.tasks.bulkAdd(tasksToInsert);
}; 