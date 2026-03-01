"use client"
import { useState, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

export default function CalendarNav() {
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Date>();
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/v1/digests/manifest')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setAvailableDates(new Set(json.data));
        }
      });
  }, []);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      if (availableDates.has(dateStr)) {
        setSelected(date);
        setIsOpen(false);
        router.push(`/?date=${dateStr}`);
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="font-mono text-[10px] uppercase border border-[#332f28] px-3 py-1 rounded hover:bg-[#d4a017] hover:text-[#0f0e0c] transition-colors"
      >
        📅 Archive
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 z-50 bg-[#181613] border border-[#332f28] p-4 rounded shadow-2xl">
          <style>{`
            .rdp { --rdp-accent-color: #d4a017; --rdp-background-color: #332f28; margin: 0; }
            .rdp-day_selected:not([disabled]) { background-color: var(--rdp-accent-color); color: #0f0e0c; }
            .rdp-day { color: #9c9285; font-family: var(--font-dm-mono); font-size: 12px; }
            .rdp-head_cell { font-size: 10px; text-transform: uppercase; color: #5c564d; }
          `}</style>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            modifiers={{ available: (date) => availableDates.has(format(date, 'yyyy-MM-dd')) }}
            modifiersStyles={{
              available: { fontWeight: 'bold', color: '#e8e2d6', textDecoration: 'underline' }
            }}
            disabled={(date) => !availableDates.has(format(date, 'yyyy-MM-dd'))}
          />
        </div>
      )}
    </div>
  );
}
