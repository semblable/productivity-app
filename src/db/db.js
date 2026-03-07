import { api } from '../api/apiClient';

export const projectColors = [
  '#FF5252',
  '#FF9800',
  '#4CAF50',
  '#2196F3',
  '#9C27B0',
  '#607D8B',
  '#795548',
  '#E91E63',
];

export const getDefaultProject = async () => {
  const projects = await api.projects.list({ _orderBy: 'createdAt ASC', _limit: 1 });
  const project = projects[0];
  if (project) {
    return project;
  }
  return api.projects.create({ name: 'Default Project', color: '#CCCCCC', createdAt: new Date() });
};