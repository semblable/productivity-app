import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, isSameDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './Calendar.css'; // Import custom calendar styles
import { useEvents, useProjects } from '../hooks/useAppData';

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
    getDay,
    locales: { 'en-US': enUS },
});

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
    const { data: events = [] } = useEvents();
    const { data: projects = [] } = useProjects();

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
        if (isSameDay(date, new Date())) {
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