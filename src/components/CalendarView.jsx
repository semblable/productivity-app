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
    // Be resilient to cloud/local aliasing issues by reading from both stores when available and de-duplicating
    const events = useLiveQuery(async () => {
        try {
            const primary = await db.events.toArray();

            // Try to also read from the alternate store if present (handles partial migrations)
            let extra = [];
            try {
                const native = typeof db.backendDB === 'function' ? db.backendDB() : null;
                const hasLocal = native?.objectStoreNames?.contains?.('events');
                const hasCloud = native?.objectStoreNames?.contains?.('events_cloud');
                if (hasLocal && hasCloud) {
                    // Read both and merge
                    const localEvents = await db.table('events').toArray();
                    const cloudEvents = await db.table('events_cloud').toArray();
                    extra = [...localEvents, ...cloudEvents];
                }
            } catch {
                // ignore
            }

            const byKey = new Map();
            const add = (e) => {
                const startMs = new Date(e.startTime).getTime();
                const endMs = new Date(e.endTime).getTime();
                const key = e['@id'] || e.id || `${e.title}|${startMs}|${endMs}|${e.projectId ?? ''}`;
                if (!byKey.has(key)) byKey.set(key, e);
            };
            primary?.forEach(add);
            extra?.forEach(add);
            return Array.from(byKey.values());
        } catch {
            return [];
        }
    }, []);

    const projects = useLiveQuery(() => db.projects.toArray(), []);

    // console.log('Loaded events from DB:', events);
    const projectMap = projects?.reduce((map, proj) => {
        map[proj.id] = proj;
        return map;
    }, {}) || {};
    // console.log('Project map:', projectMap);
    
    const toValidDate = (value) => {
        // Accept Date, number (epoch), or string (ISO/local)
        try {
            if (value instanceof Date) return value;
            const d = new Date(value);
            return isNaN(d.getTime()) ? null : d;
        } catch {
            return null;
        }
    };

    const formattedEvents = (events || [])
        .map((event) => {
            const start = toValidDate(event.startTime);
            const end = toValidDate(event.endTime);
            if (!start || !end) return null;
            return {
                title: event.title,
                start,
                end,
                resource: { ...event, project: projectMap[event.projectId] },
            };
        })
        .filter(Boolean);
    // console.log('Formatted events for calendar:', formattedEvents);
    
    const eventPropGetter = (event) => {
        const fallbackBg = '#2563eb'; // Tailwind blue-600 as safe default
        const backgroundColor = projectMap[event.resource.projectId]?.color || fallbackBg;
        const hex = /^#?[0-9a-fA-F]{6}$/;
        const hexColor = backgroundColor.startsWith('#') ? backgroundColor : (hex.test(backgroundColor) ? `#${backgroundColor}` : fallbackBg);
        // Determine readable text color for hex backgrounds
        const r = parseInt(hexColor.substring(1, 3), 16);
        const g = parseInt(hexColor.substring(3, 5), 16);
        const b = parseInt(hexColor.substring(5, 7), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        const textColor = (yiq >= 128) ? '#0b1220' : '#ffffff';

        const style = {
            backgroundColor: hexColor,
            borderRadius: '6px',
            color: textColor,
            border: `1px solid ${hexColor}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            display: 'block',
            padding: '2px 6px',
            minHeight: '22px',
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