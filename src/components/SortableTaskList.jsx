import { TaskItem } from './TaskItem';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

export const SortableTaskList = ({ tasks = [], projects = [], projectMap = {}, onStartFocus }) => {
  const sortedTasks = [...tasks].sort((a, b) => (a.order || 0) - (b.order || 0));
  const ids = sortedTasks.map(t => `task-${t.id}`);
  
  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <div className="space-y-3">
        {sortedTasks.map(task => (
          <TaskItem key={task.id} task={task} project={projectMap[task.projectId]} allProjects={projects} onStartFocus={onStartFocus} />
        ))}
      </div>
    </SortableContext>
  );
};
