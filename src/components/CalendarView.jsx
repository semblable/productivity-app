import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './Calendar.css'; // Import custom calendar styles
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

const localizer = momentLocalizer(moment);

// Custom Event component for better visual display
const EventComponent = ({ event }) => {
    const project = event.resource.project;
    return (
        <div className="flex flex-col p-1">
            <strong className="font-semibold">{event.title}</strong>
            {project && <em className="text-xs opacity-80">{project.name}</em>}
        </div>
    );
};

export const CalendarView = ({ date, view, onNavigate, onView, onSelectSlot, onSelectEvent }) => {
    const events = useLiveQuery(() => db.events.toArray(), []);
    const projects = useLiveQuery(() => db.projects.toArray(), []);

    // console.log('Loaded events from DB:', events);
    const projectMap = projects?.reduce((map, proj) => {
        map[proj.id] = proj;
        return map;
    }, {}) || {};
    // console.log('Project map:', projectMap);
    
    const formattedEvents = events?.map(event => ({
        title: event.title,
        start: new Date(event.startTime),
        end: new Date(event.endTime),
        resource: { ...event, project: projectMap[event.projectId] },
    })) || [];
    // console.log('Formatted events for calendar:', formattedEvents);
    
    const eventPropGetter = (event) => {
        const project = projectMap[event.resource.projectId];
        const backgroundColor = project?.color || 'var(--primary)';
        // A simple algorithm to determine if the text should be light or dark
        const color = backgroundColor.replace('#', '');
        const r = parseInt(color.substring(0, 2), 16);
        const g = parseInt(color.substring(2, 4), 16);
        const b = parseInt(color.substring(4, 6), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        const textColor = (yiq >= 128) ? '#020817' : '#fafafa';

        const style = {
            backgroundColor,
            borderRadius: 'var(--radius)',
            color: textColor,
            border: `1px solid ${backgroundColor}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            display: 'block',
            padding: '2px 5px',
        };
        return { style };
    };

    const dayPropGetter = (date) => {
        const today = new Date();
        if (moment(date).isSame(today, 'day')) {
            return {
                className: 'today-cell',
            };
        }
        return {};
    };

    const formats = {
        timeGutterFormat: 'HH:mm',
        eventTimeRangeFormat: ({ start, end }, culture, local) =>
            `${local.format(start, 'HH:mm')} - ${local.format(end, 'HH:mm')}`,
    };


    return (
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm flex flex-col h-[75vh]">
            <div className="flex-grow">
                <Calendar
                    localizer={localizer}
                    events={formattedEvents}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    date={date}
                    view={view}
                    onNavigate={onNavigate}
                    onView={onView}
                    onSelectSlot={onSelectSlot}
                    onSelectEvent={onSelectEvent}
                    eventPropGetter={eventPropGetter}
                    dayPropGetter={dayPropGetter}
                    components={{
                        event: EventComponent,
                    }}
                    formats={formats}
                    views={['month', 'week', 'day']}
                    className="rbc-calendar"
                    selectable={true}
                />
            </div>
        </div>
    );
}; 