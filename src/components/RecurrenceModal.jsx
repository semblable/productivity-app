import { useState, useEffect } from 'react';
import { RRule } from 'rrule';
import toast from 'react-hot-toast';

export const RecurrenceModal = ({ isOpen, onClose, onSave, initialRrule, startDate }) => {
  const [freq, setFreq] = useState(RRule.WEEKLY);
  const [interval, setInterval] = useState(1);
  const [byday, setByday] = useState([]); // Stores weekday numbers (0-6)
  const [bysetpos, setBysetpos] = useState(null);
  const [bymonthday, setBymonthday] = useState(null);
  const [bymonth, setBymonth] = useState(null);
  const [until, setUntil] = useState(null);
  const [count, setCount] = useState(null);
  const [monthlyOption, setMonthlyOption] = useState('dayOfMonth');

  useEffect(() => {
    // When the modal opens, either parse the initial rule or reset to defaults
    if (isOpen) {
      if (initialRrule) {
        try {
          const options = RRule.fromString(initialRrule).options;
          setFreq(options.freq);
          setInterval(options.interval || 1);
          setByday(options.byweekday || []);
          setBysetpos(options.bysetpos || null);
          setBymonthday(options.bymonthday || null);
          setBymonth(options.bymonth || null);
          setUntil(options.until ? new Date(options.until).toISOString().split('T')[0] : null);
          setCount(options.count || null);
          setMonthlyOption(options.bysetpos ? 'dayOfWeek' : 'dayOfMonth');
        } catch (error) {
          console.error("Invalid rrule string provided to modal:", initialRrule, error);
          toast.error("Couldn't load existing rule. Resetting.");
          resetToDefaults(); // Reset if the rule is invalid
        }
      } else {
        resetToDefaults();
      }
    }
  }, [initialRrule, isOpen]);

  const resetToDefaults = () => {
    setFreq(RRule.WEEKLY);
    setInterval(1);
    setByday([]);
    setBysetpos(null);
    setBymonthday(null);
    setBymonth(null);
    setUntil(null);
    setCount(null);
    setMonthlyOption('dayOfMonth');
  };

  const handleSave = () => {
    // Basic validation before saving
    if (freq === RRule.WEEKLY && byday.length === 0) {
      return toast.error('Please select at least one day for weekly recurrence.');
    }
    if (freq === RRule.MONTHLY && monthlyOption === 'dayOfMonth' && !bymonthday) {
        return toast.error('Please specify a day of the month.');
    }
    if (freq === RRule.MONTHLY && monthlyOption === 'dayOfWeek' && (!bysetpos || byday.length === 0)) {
        return toast.error('Please select the week and day for monthly recurrence.');
    }

    const options = {
      freq,
      interval,
      dtstart: startDate,
    };

    // Add options based on state
    if (byday.length > 0) options.byweekday = byday;
    if (bysetpos) options.bysetpos = bysetpos;
    if (bymonthday) options.bymonthday = bymonthday;
    if (bymonth) options.bymonth = bymonth;
    if (until) {
        const untilDate = new Date(until);
        // rrule.js expects UTC dates for 'until'
        options.until = new Date(Date.UTC(untilDate.getFullYear(), untilDate.getMonth(), untilDate.getDate()));
    }
    if (count) options.count = count;

    try {
      const rule = new RRule(options);
      onSave(rule.toString());
      onClose();
    } catch (error) {
        console.error("Error creating RRule:", error);
        toast.error("Could not create the recurrence rule. Please check the options.");
    }
  };

  if (!isOpen) return null;

  const weekDays = [
    { label: 'S', value: RRule.SU },
    { label: 'M', value: RRule.MO },
    { label: 'T', value: RRule.TU },
    { label: 'W', value: RRule.WE },
    { label: 'T', value: RRule.TH },
    { label: 'F', value: RRule.FR },
    { label: 'S', value: RRule.SA },
  ];

  const weekDayOptions = [
    { label: 'Sunday', value: RRule.SU },
    { label: 'Monday', value: RRule.MO },
    { label: 'Tuesday', value: RRule.TU },
    { label: 'Wednesday', value: RRule.WE },
    { label: 'Thursday', value: RRule.TH },
    { label: 'Friday', value: RRule.FR },
    { label: 'Saturday', value: RRule.SA },
  ];

  const handleFreqChange = (newFreq) => {
      setFreq(newFreq);
      // Reset fields that are not relevant for the new frequency
      setByday([]);
      setBymonthday(null);
      setBysetpos(null);
      setBymonth(null);
      setMonthlyOption('dayOfMonth');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-lg shadow-lg w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">Set Recurrence</h2>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Frequency</label>
            <select value={freq} onChange={e => handleFreqChange(Number(e.target.value))} className="p-2 rounded-md bg-secondary border border-border text-foreground w-full">
              <option value={RRule.DAILY}>Daily</option>
              <option value={RRule.WEEKLY}>Weekly</option>
              <option value={RRule.MONTHLY}>Monthly</option>
              <option value={RRule.YEARLY}>Yearly</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Repeat every</label>
            <input type="number" min="1" value={interval} onChange={e => setInterval(Math.max(1, Number(e.target.value)))} className="p-2 rounded-md bg-secondary border border-border text-foreground w-full" />
          </div>

          {freq === RRule.WEEKLY && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground">On Days</label>
              <div className="flex gap-2">
                {weekDays.map((day, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      const newByday = byday.some(d => d.weekday === day.value.weekday)
                        ? byday.filter(d => d.weekday !== day.value.weekday)
                        : [...byday, day.value];
                      setByday(newByday);
                    }}
                    className={`p-2 rounded-full w-10 h-10 ${byday.some(d => d.weekday === day.value.weekday) ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {freq === RRule.MONTHLY && (
            <div className="space-y-4 p-4 border border-border rounded-md">
                <div className="flex items-center gap-4">
                    <input type="radio" id="monthlyDayOfMonth" name="monthlyOption" value="dayOfMonth" checked={monthlyOption === 'dayOfMonth'} onChange={() => setMonthlyOption('dayOfMonth')} />
                    <label htmlFor="monthlyDayOfMonth" className="text-sm font-medium text-muted-foreground">On day</label>
                    <input type="number" min="1" max="31" value={bymonthday || ''} onChange={e => setBymonthday(Math.max(1, Number(e.target.value)))} disabled={monthlyOption !== 'dayOfMonth'} className="p-2 rounded-md bg-secondary border border-border text-foreground w-24" />
                </div>
                <div className="flex items-center gap-4">
                    <input type="radio" id="monthlyDayOfWeek" name="monthlyOption" value="dayOfWeek" checked={monthlyOption === 'dayOfWeek'} onChange={() => setMonthlyOption('dayOfWeek')} />
                    <label htmlFor="monthlyDayOfWeek" className="text-sm font-medium text-muted-foreground">On the</label>
                    <select value={bysetpos || ''} onChange={e => setBysetpos(Number(e.target.value))} disabled={monthlyOption !== 'dayOfWeek'} className="p-2 rounded-md bg-secondary border border-border text-foreground">
                        <option value="" disabled>Select...</option>
                        <option value="1">First</option>
                        <option value="2">Second</option>
                        <option value="3">Third</option>
                        <option value="4">Fourth</option>
                        <option value="-1">Last</option>
                    </select>
                    <select value={byday[0]?.weekday ?? ''} onChange={e => {
                        const weekday = Number(e.target.value);
                        const rule = weekDayOptions.find(d => d.value.weekday === weekday)?.value;
                        if (rule) setByday([rule]);
                    }} disabled={monthlyOption !== 'dayOfWeek'} className="p-2 rounded-md bg-secondary border border-border text-foreground">
                        <option value="" disabled>Select...</option>
                        {weekDayOptions.map(d => <option key={d.value.weekday} value={d.value.weekday}>{d.label}</option>)}
                    </select>
                </div>
            </div>
          )}

          {freq === RRule.YEARLY && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground">On</label>
              <select value={bymonth || ''} onChange={e => setBymonth(Number(e.target.value))} className="p-2 rounded-md bg-secondary border border-border text-foreground w-full">
                <option value="" disabled>Select...</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                ))}
              </select>
            </div>
          )}

          <div className="p-4 border border-border rounded-md">
            <h3 className="text-lg font-medium mb-2">Ends</h3>
            <div className="flex items-center gap-4">
                <input type="radio" id="endsNever" name="endsOption" checked={!until && !count} onChange={() => { setUntil(null); setCount(null); }} />
                <label htmlFor="endsNever" className="text-sm font-medium text-muted-foreground">Never</label>
            </div>
            <div className="flex items-center gap-4 mt-2">
                <input type="radio" id="endsOn" name="endsOption" checked={!!until} onChange={() => { setCount(null); setUntil(new Date().toISOString().split('T')[0]); }} />
                <label htmlFor="endsOn" className="text-sm font-medium text-muted-foreground">On</label>
                <input type="date" value={until || ''} onChange={e => setUntil(e.target.value)} disabled={!until} className="p-2 rounded-md bg-secondary border border-border text-foreground" />
            </div>
            <div className="flex items-center gap-4 mt-2">
                <input type="radio" id="endsAfter" name="endsOption" checked={!!count} onChange={() => { setUntil(null); setCount(1); }} />
                <label htmlFor="endsAfter" className="text-sm font-medium text-muted-foreground">After</label>
                <input type="number" min="1" value={count || ''} onChange={e => setCount(Math.max(1, Number(e.target.value)))} disabled={!count} className="p-2 rounded-md bg-secondary border border-border text-foreground w-24" />
                <span className="text-muted-foreground">occurrences</span>
            </div>
          </div>

        </div>
        <div className="flex justify-end gap-4 mt-6">
          <button onClick={onClose} className="bg-secondary text-secondary-foreground p-2 px-4 rounded-md">Cancel</button>
          <button onClick={handleSave} className="bg-primary hover:opacity-90 text-primary-foreground p-2 px-4 rounded-md">Save</button>
        </div>
      </div>
    </div>
  );
};