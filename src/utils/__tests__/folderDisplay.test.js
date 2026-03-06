import { getFolderDisplayPath, prepareFoldersForDisplay } from '../folderDisplay';

describe('folderDisplay', () => {
  const folders = [
    { id: 1, name: 'Root', parentId: null, projectId: 10 },
    { id: 2, name: 'Child', parentId: 1, projectId: 10 },
    { id: 3, name: 'Other', parentId: null, projectId: 11 },
  ];
  const projects = [{ id: 10, name: 'Alpha' }, { id: 11, name: 'Beta' }];
  const projectMap = projects.reduce((m, p) => { m[p.id] = p; return m; }, {});

  test('getFolderDisplayPath builds hierarchical path with project', () => {
    const path = getFolderDisplayPath(folders[1], folders, projectMap);
    expect(path).toBe('Alpha > Root > Child');
  });

  test('prepareFoldersForDisplay adds displayPath and sorts', () => {
    const prepared = prepareFoldersForDisplay(folders, projectMap);
    expect(prepared.every(f => typeof f.displayPath === 'string')).toBe(true);
    const names = prepared.map(f => f.displayPath);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });
});




