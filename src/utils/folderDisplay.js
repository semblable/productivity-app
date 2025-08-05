/**
 * Utility functions for displaying folder hierarchies in dropdowns and lists
 */

/**
 * Get the full hierarchical path for a folder
 * @param {Object} folder - The folder object
 * @param {Array} allFolders - Array of all folders to build hierarchy from
 * @param {Object} projectMap - Map of project IDs to project objects
 * @returns {string} Full path like "Project > Parent Folder > Child Folder"
 */
export const getFolderDisplayPath = (folder, allFolders, projectMap = {}) => {
  const path = [];
  
  // Add project name if available
  if (folder.projectId && projectMap[folder.projectId]) {
    path.push(projectMap[folder.projectId].name);
  }
  
  // Recursively build the folder path
  const buildPath = (currentFolder) => {
    if (currentFolder.parentId) {
      const parent = allFolders.find(f => f.id === currentFolder.parentId);
      if (parent) {
        buildPath(parent);
      }
    }
    path.push(currentFolder.name);
  };
  
  buildPath(folder);
  
  return path.join(' > ');
};

/**
 * Sort folders for display in dropdowns with hierarchy
 * @param {Array} folders - Array of folder objects
 * @param {Object} projectMap - Map of project IDs to project objects
 * @returns {Array} Sorted folders with display paths
 */
export const prepareFoldersForDisplay = (folders, projectMap = {}) => {
  return folders
    .map(folder => ({
      ...folder,
      displayPath: getFolderDisplayPath(folder, folders, projectMap)
    }))
    .sort((a, b) => a.displayPath.localeCompare(b.displayPath));
};

/**
 * Get display name with indentation for nested rendering
 * @param {Object} folder - The folder object
 * @param {Array} allFolders - Array of all folders
 * @param {number} level - Current nesting level (for indentation)
 * @returns {string} Indented folder name
 */
export const getFolderDisplayName = (folder, allFolders, level = 0) => {
  const indent = '  '.repeat(level); // 2 spaces per level
  return `${indent}${folder.name}`;
};