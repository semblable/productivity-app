import React, { useMemo } from 'react';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import { format, startOfYear, endOfYear, formatISO } from 'date-fns';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { useHabitCompletions } from '../hooks/useAppData';

const HabitCalendar = ({ habitId }) => {
    const { data: completions = [] } = useHabitCompletions({ habitId });

    const values = useMemo(() => {
        if (!completions) return [];
        return completions.map(c => {
            // Ensure date is treated as local timezone, not UTC
            const date = new Date(c.date + 'T00:00:00');
            return {
                date: formatISO(date, { representation: 'date' }),
                count: 1,
            };
        });
    }, [completions]);
    
    const today = new Date();
    const startDate = startOfYear(today);
    const endDate = endOfYear(today);

    const getDayClassName = (value) => {
        const classNames = [];
        const date = value ? new Date(value.date) : null;
    
        if (date && format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
            classNames.push('is-today');
        }
    
        if (!value || !value.count) {
            classNames.push('color-empty');
        } else {
            classNames.push('color-filled');
        }
    
        return classNames.join(' ');
    };

    return (
        <div className="mt-4 habit-calendar-container">
            <ReactTooltip id={`heatmap-tooltip-${habitId}`} />
            <CalendarHeatmap
                startDate={startDate}
                endDate={endDate}
                values={values}
                classForValue={getDayClassName}
                tooltipDataAttrs={value => {
                    if (!value || !value.date) {
                        return { 'data-tooltip-id': `heatmap-tooltip-${habitId}` };
                    }
                    const dateStr = format(new Date(value.date + 'T00:00:00'), 'MMMM d, yyyy');
                    const content = value.count 
                        ? `Completed on ${dateStr}`
                        : `Not completed on ${dateStr}`;
                    return {
                        'data-tooltip-id': `heatmap-tooltip-${habitId}`,
                        'data-tooltip-content': content,
                    };
                }}
                monthLabels={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']}
                showWeekdayLabels={true}
                weekdayLabels={['S', 'M', 'T', 'W', 'T', 'F', 'S']}
            />
        </div>
    );
};

export default HabitCalendar; 