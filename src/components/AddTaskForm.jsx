import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { RecurrenceModal } from './RecurrenceModal';
import { prepareFoldersForDisplay } from '../utils/folderDisplay';
import { normalizeId, normalizeNullableId } from '../db/id-utils';

const priorityLevels = {
    0: 'None',
    1: 'Low',
    2: 'Medium',
    3: 'High'
};

export const AddTaskForm = ({ projects }) => {
   const [text, setText] = useState('');
   const [dueDate, setDueDate] = useState('');
   const [projectId, setProjectId] = useState('');
   const [priority, setPriority] = useState(0);
   const [recurrence, setRecurrence] = useState('none');
   const [folderId, setFolderId] = useState('');
   const [isHabit, setIsHabit] = useState(false);
   const [goalId, setGoalId] = useState('none');
   const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
   const [rrule, setRrule] = useState(null);

   const goals = useLiveQuery(() => db.goals.toArray(), []);
   const folders = useLiveQuery(
     () => projectId ? db.folders.where({ projectId: normalizeNullableId(projectId) }).toArray() : [],
     [projectId]
   );

   // Create project map and prepare folders with hierarchy display
   const projectMap = useMemo(() => {
     return projects?.reduce((map, proj) => {
       map[proj.id] = proj;
       return map;
     }, {}) || {};
   }, [projects]);

   const displayFolders = useMemo(() => {
     return folders ? prepareFoldersForDisplay(folders, projectMap) : [];
   }, [folders, projectMap]);

   const addTask = async (e) => {
      e.preventDefault();
     if (!text.trim()) return toast.error("Task text cannot be empty.");
     
      const finalProjectId = normalizeNullableId(projectId);

     let rruleString = rrule ? rrule.toString() : null;

     try {
         const newTaskId = await db.tasks.add({
         text: text.trim(),
         completed: false,
         createdAt: new Date(),
         dueDate: dueDate ? new Date(dueDate) : null,
                 projectId: finalProjectId,
        folderId: normalizeNullableId(folderId),
        order: 0,
         priority: Number(priority),
         goalId: goalId === 'none' ? null : normalizeId(goalId),
         rrule: rruleString,
         parentId: null,
         templateId: null, // Regular tasks are not instances of templates
       });

       if (isHabit && rruleString) {
         await db.habits.add({
            taskId: newTaskId,
            name: text.trim(),
            startDate: new Date(),
            streak: 0,
            bestStreak: 0,
            lastCompletionDate: null,
            streakFreezes: 0,
            streakFriezes: 0,
            lastStreakMilestone: 0
         });
       }

       setText('');
       setDueDate('');
       setPriority(0);
       setRecurrence('none');
       setIsHabit(false);
       setGoalId('none');
       setFolderId('');
       setProjectId('');
       toast.success("Task added!");
     } catch (error) {
       console.error('Failed to add task:', error);
       toast.error("Failed to add task.");
     }
   };

    const inputClasses = "p-2 rounded-md bg-secondary border border-border text-foreground focus:ring-2 focus:ring-ring focus:outline-none";

   return (
     <>
     <form onSubmit={addTask} className="flex flex-wrap items-center gap-3 mb-4 bg-card p-4 rounded-lg border border-border shadow-sm">
        <input
           type="text"
           placeholder="Add new task..."
           value={text}
           onChange={(e) => setText(e.target.value)}
           className={`flex-grow min-w-[200px] ${inputClasses}`}
         />
        <select value={projectId} onChange={e => setProjectId(e.target.value)} className={inputClasses}>
            <option value="">No Project</option>
            {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {projectId && displayFolders && displayFolders.length > 0 && (
            <select value={folderId} onChange={e => setFolderId(e.target.value)} className={inputClasses}>
                <option value="">No Folder</option>
                {displayFolders.map(f => <option key={f.id} value={f.id}>{f.displayPath}</option>)}
            </select>
        )}
        <select value={priority} onChange={e => setPriority(e.target.value)} className={inputClasses}>
            {Object.entries(priorityLevels).map(([level, name]) => <option key={level} value={level}>{name}</option>)}
        </select>
        <button type="button" onClick={() => setShowRecurrenceModal(true)} className={inputClasses}>
            {rrule ? 'Edit Recurrence' : 'Set Recurrence'}
        </button>
        {recurrence !== 'none' && (
            <div className="flex items-center gap-2">
                <input 
                    type="checkbox"
                    id="isHabit"
                    checked={isHabit}
                    onChange={(e) => setIsHabit(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="isHabit" className="text-sm text-muted-foreground">Track as a habit</label>
            </div>
        )}
        <input 
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputClasses}
        />
        {goals && goals.length > 0 && (
          <select value={goalId} onChange={e => setGoalId(e.target.value)} className={inputClasses}>
            <option value="none">No Goal</option>
            {goals.map(g => <option key={g.id} value={g.id}>{g.description}</option>)}
          </select>
        )}
        <button type="submit" className="bg-primary hover:opacity-90 text-primary-foreground p-2 px-4 rounded-md flex items-center gap-2">
           <Plus size={16} /> Add Task
        </button>
      </form>
      <RecurrenceModal
        isOpen={showRecurrenceModal}
        onClose={() => setShowRecurrenceModal(false)}
        onSave={(newRrule) => {
          setRrule(newRrule);
          setShowRecurrenceModal(false);
        }}
        initialRrule={rrule ? rrule.toString() : null}
      />
      </>
   );
 }; 