import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RRule, RRuleSet, rrulestr } from 'rrule';
import toast from 'react-hot-toast';
import { scheduleNotification, cancelScheduledNotification, clearEventNotificationFlags } from '../hooks/useNotifications';
import { RecurrenceModal } from './RecurrenceModal';
import { normalizeId } from '../db/id-utils';
import { api } from '../api/apiClient';
import { useGoals, useTasks } from '../hooks/useAppData';

export const AddEventModal = ({ isOpen, onClose, eventData, projects, onStartTracking }) => {
    const queryClient = useQueryClient();
    const [title, setTitle] = useState('');
    const [projectId, setProjectId] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    // 'recurrence' now holds the *value* of the dropdown ('none', 'daily', 'custom-weekly', etc.)
    const [recurrence, setRecurrence] = useState('none');
    // 'customRrule' holds the actual rrule string ONLY when it's a custom rule.
    const [customRrule, setCustomRrule] = useState('');
    const [showRecurrenceUpdateModal, setShowRecurrenceUpdateModal] = useState(false);
    const [updateType, setUpdateType] = useState(null); // 'update' or 'delete'
    const [showAdvancedRecurrenceModal, setShowAdvancedRecurrenceModal] = useState(false);

    const getRecurrenceOptions = useCallback((startDate) => {
        if (!startDate || isNaN(startDate)) {
            return [{ value: 'none', label: 'Does not repeat' }];
        }
        const dayOfMonth = startDate.getDate();
        const dayOfWeek = startDate.toLocaleString('en-us', { weekday: 'long' });
        const month = startDate.toLocaleString('en-us', { month: 'long' });

        return [
            { value: 'none', label: 'Does not repeat', rrule: null },
            { value: 'daily', label: 'Every day', rrule: new RRule({ freq: RRule.DAILY, dtstart: startDate }) },
            { value: 'weekly', label: `Every week on ${dayOfWeek}`, rrule: new RRule({ freq: RRule.WEEKLY, dtstart: startDate }) },
            { value: 'weekly-weekdays', label: 'Every weekday (Mon-Fri)', rrule: new RRule({ freq: RRule.WEEKLY, byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR], dtstart: startDate }) },
            { value: 'monthly', label: `Every month on the ${dayOfMonth}${dayOfMonth % 10 === 1 && dayOfMonth !== 11 ? 'st' : dayOfMonth % 10 === 2 && dayOfMonth !== 12 ? 'nd' : dayOfMonth % 10 === 3 && dayOfMonth !== 13 ? 'rd' : 'th'}`, rrule: new RRule({ freq: RRule.MONTHLY, dtstart: startDate }) },
            { value: 'yearly', label: `Every year on ${month} ${dayOfMonth}`, rrule: new RRule({ freq: RRule.YEARLY, dtstart: startDate }) },
            { value: 'custom-weekly', label: 'Custom...', rrule: null },
        ];
    }, []);

    const { data: tasks = [] } = useTasks();
    const { data: goals = [] } = useGoals();

    const titleSuggestions = Array.from(new Set([
        ...(tasks?.filter(t => !t.completed).map(t => t.text) || []),
        ...(goals?.map(g => g.description) || []),
    ]));

    useEffect(() => {
        if (eventData) {
            setTitle(eventData.title || '');
            setProjectId(eventData.projectId || (projects.length > 0 ? projects[0].id : ''));
            // Directly format to 'YYYY-MM-DDTHH:mm' which is what datetime-local expects
            const formatForInput = (date) => {
                const d = new Date(date);
                // Manually format to avoid timezone issues from toISOString
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day}T${hours}:${minutes}`;
            };

            setStartTime(eventData.startTime ? formatForInput(eventData.startTime) : '');
            setEndTime(eventData.endTime ? formatForInput(eventData.endTime) : '');

            if (eventData.rrule) {
                const recurrenceOptions = getRecurrenceOptions(new Date(eventData.startTime));
                // Find a preset that matches the event's rrule string
                const matchingOption = recurrenceOptions.find(opt => opt.rrule && opt.rrule.toString() === eventData.rrule);

                if (matchingOption) {
                    // It's a preset, so set the dropdown value and clear custom rule state
                    setRecurrence(matchingOption.value);
                    setCustomRrule('');
                } else {
                    // It's not a preset, so it must be a custom rule
                    setRecurrence('custom-weekly');
                    setCustomRrule(eventData.rrule);
                }
            } else {
                // No rrule, so reset everything
                setRecurrence('none');
                setCustomRrule('');
            }
        }
    }, [eventData, projects, getRecurrenceOptions]);

    // Derived state to check if the current recurrence is custom
    const isCustomRecurrence = recurrence === 'custom-weekly';

    if (!isOpen) return null;

    const handleStartTracking = () => {
        if (!eventData || !eventData.id) return;
        scheduleNotification(
            new Date(eventData.endTime),
            `Event Finished: ${eventData.title}`,
            { body: 'Your scheduled time block has ended.' },
            `event-finish-${eventData.id}`
        );
        if (typeof onStartTracking === 'function') {
            onStartTracking(eventData);
        }
        onClose();
    };

    const executeSave = async (updateScope) => {
        if (!title.trim() || !projectId || !startTime || !endTime) {
            return toast.error("Please fill out all fields.");
        }
        const start = new Date(startTime);
        const end = new Date(endTime);
        if (start >= end) {
            return toast.error("End time must be after start time.");
        }

        let rruleString = null;
        if (recurrence !== 'none') {
            if (isCustomRecurrence) {
                // For custom rules, use the string from the state
                rruleString = customRrule;
            } else {
                // For presets, find the matching option and get its rrule string
                const recurrenceOptions = getRecurrenceOptions(start);
                const selectedOption = recurrenceOptions.find(o => o.value === recurrence);
                if (selectedOption && selectedOption.rrule) {
                    rruleString = selectedOption.rrule.toString();
                }
            }
        }

        const eventToSave = {
            title: title.trim(),
            projectId: normalizeId(projectId),
            startTime: start,
            endTime: end,
            rrule: rruleString,
            templateId: null, // New events are not instances
        };
        
        try {
            if (eventData.id) {
                const parentEvent = eventData.parentId ? await api.events.get(eventData.parentId) : eventData;
                if (updateScope === 'one') {
                    const rset = rrulestr(parentEvent.rrule, { forceset: true });
                    rset.exdate(new Date(eventData.startTime));
                    await api.events.update(parentEvent.id, { rrule: rset.toString() });
                    delete eventToSave.rrule;
                    await api.events.create(eventToSave);
                    toast.success("Event updated as a single instance!");
                } else if (updateScope === 'following') {
                    const ruleOrSet = rrulestr(parentEvent.rrule);
                    const mainRule = (ruleOrSet instanceof RRuleSet) ? ruleOrSet.rrules()[0] : ruleOrSet;
                    mainRule.options.until = new Date(eventData.startTime.getTime() - 1);
                    await api.events.update(parentEvent.id, { rrule: ruleOrSet.toString() });
                    const futureChildren = (await api.events.list({ parentId: parentEvent.id }))
                        .filter((child) => new Date(child.startTime) > new Date(start.getTime()));
                    if (futureChildren.length > 0) {
                        await api.events.bulkRemove(futureChildren.map((child) => child.id));
                    }
                    await api.events.create(eventToSave);
                    toast.success("Split event series successfully!");
                } else { // 'all'
                    await api.events.update(parentEvent.id, eventToSave);
                    const children = await api.events.list({ parentId: parentEvent.id });
                    if (children.length > 0) {
                        await api.events.bulkRemove(children.map((child) => child.id));
                    }
                    toast.success("Entire event series updated!");
                }
            } else {
                await api.events.create(eventToSave);
                toast.success("Event added to calendar!");
            }
            await queryClient.invalidateQueries();
            onClose();
        } catch (error) {
            console.error("Failed to save event:", error);
            toast.error("Failed to save event.");
        } finally {
            setShowRecurrenceUpdateModal(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const isRecurringEvent = eventData.rrule || eventData.parentId;
        if (eventData.id && isRecurringEvent) {
            setUpdateType('update');
            setShowRecurrenceUpdateModal(true);
        } else {
            executeSave('all');
        }
    };
    
    const executeDelete = async (deleteScope) => {
        if (!eventData.id) return onClose();
        try {
            const parentEvent = eventData.parentId ? await api.events.get(eventData.parentId) : eventData;
            const deleteTimeEntriesForEventIds = async (eventIds) => {
                if (!eventIds || eventIds.length === 0) return;
                try {
                    const entries = await api.timeEntries.list({ eventId_in: eventIds.join(',') });
                    if (entries.length > 0) {
                        await api.timeEntries.bulkRemove(entries.map((entry) => entry.id));
                    }
                } catch (e) {
                    console.error('Failed to delete time entries for events', eventIds, e);
                }
            };
            if (deleteScope === 'one') {
                if (parentEvent.id === eventData.id) {
                    const rset = rrulestr(parentEvent.rrule, { forceset: true });
                    rset.exdate(new Date(eventData.startTime));
                    await api.events.update(parentEvent.id, { rrule: rset.toString() });
                    // Cancel any pending finish notifications and clear flags for this event and its matching child
                    cancelScheduledNotification(`event-finish-${eventData.id}`);
                    clearEventNotificationFlags(eventData.id);
                    const childToDelete = (await api.events.list({ parentId: parentEvent.id }))
                        .find((child) => new Date(child.startTime).getTime() === new Date(eventData.startTime).getTime());
                    if (childToDelete) {
                        cancelScheduledNotification(`event-finish-${childToDelete.id}`);
                        clearEventNotificationFlags(childToDelete.id);
                        await deleteTimeEntriesForEventIds([childToDelete.id]);
                        await api.events.remove(childToDelete.id);
                    }
                } else {
                    const rset = rrulestr(parentEvent.rrule, { forceset: true });
                    rset.exdate(new Date(eventData.startTime));
                    await api.events.update(parentEvent.id, { rrule: rset.toString() });
                    cancelScheduledNotification(`event-finish-${eventData.id}`);
                    clearEventNotificationFlags(eventData.id);
                    await deleteTimeEntriesForEventIds([eventData.id]);
                    await api.events.remove(eventData.id);
                }
                toast.success("Event instance deleted.");
            } else if (deleteScope === 'following') {
                const originalRule = rrulestr(parentEvent.rrule);
                const ruleOptions = originalRule.options;
                const untilDate = new Date(eventData.startTime.getTime() - 1);
                const newRule = new RRule({ ...ruleOptions, until: untilDate });
                await api.events.update(parentEvent.id, { rrule: newRule.toString() });
                const futureChildren = (await api.events.list({ parentId: parentEvent.id }))
                    .filter((child) => new Date(child.startTime) >= new Date(eventData.startTime));
                // Cancel notifications and clear flags for all affected future children
                futureChildren.forEach(c => {
                    cancelScheduledNotification(`event-finish-${c.id}`);
                    clearEventNotificationFlags(c.id);
                });
                await deleteTimeEntriesForEventIds(futureChildren.map(c => c.id));
                if (futureChildren.length > 0) {
                    await api.events.bulkRemove(futureChildren.map(c => c.id));
                }
                toast.success("Deleted this and all future events.");
            } else { // 'all'
                const children = await api.events.list({ parentId: parentEvent.id });
                const allIdsToDelete = children.map(c => c.id);
                allIdsToDelete.push(parentEvent.id);
                // Cancel notifications and clear flags for parent and all children
                allIdsToDelete.forEach(id => {
                    cancelScheduledNotification(`event-finish-${id}`);
                    clearEventNotificationFlags(id);
                });
                await deleteTimeEntriesForEventIds(allIdsToDelete);
                await api.events.bulkRemove(allIdsToDelete);
                toast.success("Entire event series deleted.");
            }
            await queryClient.invalidateQueries();
        } catch (error) {
            console.error("Failed to delete event:", error);
            toast.error("Failed to delete event.");
        } finally {
            setShowRecurrenceUpdateModal(false);
            onClose();
        }
    };

    const handleDelete = async () => {
        const isRecurring = eventData.rrule || eventData.parentId;
        if (isRecurring) {
            setUpdateType('delete');
            setShowRecurrenceUpdateModal(true);
        } else {
            toast((t) => (
                <div className="flex flex-col gap-2">
                    <p>Delete this event?</p>
                    <div className="flex gap-2 justify-end">
                        <button
                            className="bg-red-600 hover:bg-red-700 text-white p-1 px-3 rounded text-sm"
                            onClick={async () => {
                                try {
                                    cancelScheduledNotification(`event-finish-${eventData.id}`);
                                    clearEventNotificationFlags(eventData.id);
                                    const entries = await api.timeEntries.list({ eventId: eventData.id });
                                    if (entries.length > 0) {
                                        await api.timeEntries.bulkRemove(entries.map((entry) => entry.id));
                                    }
                                    await api.events.remove(eventData.id);
                                    await queryClient.invalidateQueries();
                                    toast.success("Event deleted.");
                                    onClose();
                                } catch (error) {
                                    console.error("Failed to delete event:", error);
                                    toast.error("Failed to delete event.");
                                } finally {
                                    toast.dismiss(t.id);
                                }
                            }}
                        >
                            Delete
                        </button>
                        <button 
                            className="bg-gray-500 hover:bg-gray-600 text-white p-1 px-3 rounded text-sm"
                            onClick={() => toast.dismiss(t.id)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ));
        }
    };

    const recurrenceOptions = getRecurrenceOptions(startTime ? new Date(startTime) : new Date());
    
    const handleRecurrenceChange = (e) => {
        const value = e.target.value;
        setRecurrence(value);
        if (value === 'custom-weekly') {
            setShowAdvancedRecurrenceModal(true);
        }
    };

    const handleSaveRecurrence = (rruleString) => {
        setRecurrence('custom-weekly'); // Keep dropdown on 'Custom...'
        setCustomRrule(rruleString);   // Store the actual rule
        setShowAdvancedRecurrenceModal(false);
    };

    const RecurrenceUpdateModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center">
            <div className="bg-card border border-border p-6 rounded-lg shadow-xl w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4">Recurring Event</h3>
                <p className="text-sm text-muted-foreground mb-6">
                    How do you want to {updateType} this recurring event?
                </p>
                <div className="space-y-3">
                    <button onClick={() => updateType === 'update' ? executeSave('one') : executeDelete('one')} className="w-full text-left p-3 rounded-md hover:bg-accent transition-colors">
                        <p className="font-semibold">This event only</p>
                        <p className="text-xs text-muted-foreground">This instance will be changed and the rest of the series will remain the same.</p>
                    </button>
                    <button onClick={() => updateType === 'update' ? executeSave('following') : executeDelete('following')} className="w-full text-left p-3 rounded-md hover:bg-accent transition-colors">
                        <p className="font-semibold">This and following events</p>
                        <p className="text-xs text-muted-foreground">This and all subsequent events will be changed.</p>
                    </button>
                    <button onClick={() => updateType === 'update' ? executeSave('all') : executeDelete('all')} className="w-full text-left p-3 rounded-md hover:bg-accent transition-colors">
                        <p className="font-semibold">All events</p>
                        <p className="text-xs text-muted-foreground">All events in this series will be changed.</p>
                    </button>
                </div>
                <div className="mt-6 text-right">
                    <button onClick={() => setShowRecurrenceUpdateModal(false)} className="bg-gray-500 hover:bg-gray-600 text-white p-2 px-4 rounded">Cancel</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            {showRecurrenceUpdateModal && <RecurrenceUpdateModal />}
            <RecurrenceModal
                isOpen={showAdvancedRecurrenceModal}
                onClose={() => setShowAdvancedRecurrenceModal(false)}
                onSave={handleSaveRecurrence}
                initialRrule={isCustomRecurrence ? customRrule : null}
                startDate={startTime ? new Date(startTime) : new Date()}
            />
            <div className={`bg-card border border-border p-6 rounded-lg shadow-xl w-full max-w-lg ${showRecurrenceUpdateModal || showAdvancedRecurrenceModal ? 'filter blur-sm' : ''}`}>
                <h2 className="text-xl font-bold mb-4">{eventData.id ? 'Edit Event' : 'Add New Event'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        list="event-title-suggestions"
                        placeholder="Event Title"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full p-2 rounded bg-secondary text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                    />
                    <datalist id="event-title-suggestions">
                        {titleSuggestions.map((sugg, idx) => (
                            <option key={idx} value={sugg} />
                        ))}
                    </datalist>
                    <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full p-2 rounded-md bg-secondary text-foreground focus:ring-2 focus:ring-ring focus:outline-none">
                        <option value="" disabled>Select a Project</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Start Time</label>
                            <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 rounded-md bg-secondary text-foreground focus:ring-2 focus:ring-ring focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">End Time</label>
                            <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 rounded-md bg-secondary text-foreground focus:ring-2 focus:ring-ring focus:outline-none" />
                        </div>
                    </div>
                    <select value={recurrence} onChange={handleRecurrenceChange} className="w-full p-2 rounded-md bg-secondary text-foreground focus:ring-2 focus:ring-ring focus:outline-none">
                       {recurrenceOptions.map(option => (
                           <option key={option.value} value={option.value}>{option.label}</option>
                       ))}
                    </select>
                    {isCustomRecurrence && (
                        <button type="button" onClick={() => setShowAdvancedRecurrenceModal(true)} className="w-full p-2 rounded-md bg-secondary text-foreground focus:ring-2 focus:ring-ring focus:outline-none">
                            Edit Recurrence
                        </button>
                    )}
                    <div className="flex justify-between items-center mt-6">
                        <div>
                            {eventData.id && (
                                <button type="button" onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white p-2 px-4 rounded">Delete</button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            {eventData.id && (
                                <button 
                                    type="button" 
                                    onClick={handleStartTracking} 
                                    className="bg-green-600 hover:bg-green-700 text-white p-2 px-4 rounded"
                                >
                                    Start Tracking
                                </button>
                            )}
                            <button type="button" onClick={onClose} className="bg-gray-500 hover:bg-gray-600 text-white p-2 px-4 rounded">Cancel</button>
                            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-2 px-4 rounded">
                                {eventData.id ? 'Save Changes' : 'Add Event'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};