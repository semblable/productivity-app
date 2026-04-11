import { getFolderDisplayPath, prepareFoldersForDisplay, getFolderDisplayName } from '../folderDisplay';

describe('folderDisplay', () => {
  const folders = [
    { id: 1, name: 'Root', parentId: null, projectId: 10 },
    { id: 2, name: 'Child', parentId: 1, projectId: 10 },
    { id: 3, name: 'Other', parentId: null, projectId: 11 },
    { id: 4, name: 'Grandchild', parentId: 2, projectId: 10 },
  ];
  const projects = [{ id: 10, name: 'Alpha' }, { id: 11, name: 'Beta' }];
  const projectMap = projects.reduce((m, p) => { m[p.id] = p; return m; }, {});

  test('getFolderDisplayPath builds hierarchical path with project', () => {
    const path = getFolderDisplayPath(folders[1], folders, projectMap);
    expect(path).toBe('Alpha > Root > Child');
  });

  test('root folder without parent shows project > folder', () => {
    const path = getFolderDisplayPath(folders[0], folders, projectMap);
    expect(path).toBe('Alpha > Root');
  });

  test('deeply nested folder (3 levels) builds full path', () => {
    const path = getFolderDisplayPath(folders[3], folders, projectMap);
    expect(path).toBe('Alpha > Root > Child > Grandchild');
  });

  test('folder with missing project in projectMap shows folder name only', () => {
    const noProjectFolder = { id: 99, name: 'Orphan', parentId: null, projectId: 999 };
    const path = getFolderDisplayPath(noProjectFolder, [...folders, noProjectFolder], projectMap);
    expect(path).toBe('Orphan');
  });

  test('folder with no projectId shows folder name only', () => {
    const noProjectFolder = { id: 99, name: 'Loose', parentId: null, projectId: null };
    const path = getFolderDisplayPath(noProjectFolder, [...folders, noProjectFolder], projectMap);
    expect(path).toBe('Loose');
  });

  test('prepareFoldersForDisplay adds displayPath and sorts', () => {
    const prepared = prepareFoldersForDisplay(folders, projectMap);
    expect(prepared.every(f => typeof f.displayPath === 'string')).toBe(true);
    const names = prepared.map(f => f.displayPath);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  test('prepareFoldersForDisplay with empty projectMap still works', () => {
    const prepared = prepareFoldersForDisplay(folders, {});
    expect(prepared).toHaveLength(folders.length);
  });

  test('getFolderDisplayName returns name at level 0', () => {
    expect(getFolderDisplayName(folders[0], folders, 0)).toBe('Root');
  });

  test('getFolderDisplayName indents at level 2', () => {
    expect(getFolderDisplayName(folders[0], folders, 2)).toBe('    Root');
  });

  test('getFolderDisplayName indents at level 3', () => {
    expect(getFolderDisplayName(folders[0], folders, 3)).toBe('      Root');
  });
});




