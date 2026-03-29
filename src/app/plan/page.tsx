"use client";

import { useEffect, useState, useRef, useMemo } from 'react';
import { activityClient } from '@/api/client';
import { Activity } from '@/gen/activity/v1/activity_pb';
import {
  format, addDays, subDays, isSameDay, isSameMonth,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Trash2, ZoomIn, ZoomOut, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8080';
const SCALE_MIN = 0.5;
const SCALE_MAX = 3;
const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

interface DailyPlan {
  id: string;
  activityId: string;
  date: string;
  startMinute: number;
  plannedMinutes: number;
  memo: string;
  createdAt: string;
}

interface Popover {
  id?: string;
  startMinute: number;
  endMinute: number;
  activityId: string;
  memo: string;
  x: number;
  y: number;
}

export default function PlanPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [now] = useState(new Date());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);

  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const calendarRef = useRef<HTMLDivElement>(null);

  const [popover, setPopover] = useState<Popover | null>(null);
  const [saving, setSaving] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const activityMap = useMemo(() => {
    const m: Record<string, Activity> = {};
    activities.forEach(a => (m[a.id] = a));
    return m;
  }, [activities]);

  useEffect(() => {
    activityClient.listActivities({}).then(res => setActivities(res.activities));
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [currentDate]);

  useEffect(() => {
    if (!showCalendar) return;
    const handler = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) setShowCalendar(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCalendar]);

  useEffect(() => {
    if (!popover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPopover(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popover]);

  useEffect(() => {
    if (!loading && scrollRef.current) {
      const top = (now.getHours() * 60 + now.getMinutes()) * scale;
      scrollRef.current.scrollTop = Math.max(0, top - 200);
    }
  }, [loading, scale]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const res = await fetch(`${BACKEND}/api/v1/plans?date=${dateStr}`);
      const data = await res.json();
      setPlans(data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gridRef.current || activities.length === 0) return;
    if (popover) { setPopover(null); return; }
    
    const rect = gridRef.current.getBoundingClientRect();
    
    // Total vertical offset from top of grid (00:00)
    const clickY = e.clientY - rect.top;
    const rawMin = clickY / scale;
    
    // Snap to 5-min interval
    const startMinute = Math.max(0, Math.min(1435, Math.round(rawMin / 5) * 5));
    
    setPopover({
      startMinute,
      endMinute: Math.min(1440, startMinute + 30),
      activityId: activities[0].id,
      memo: '',
      x: e.clientX - rect.left,
      y: startMinute * scale, // Visual snap
    });
  };

  const timeStrToMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return Math.max(0, Math.min(1439, (h || 0) * 60 + (m || 0)));
  };
  const minToTimeStr = (mins: number) =>
    `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

  const handleSavePlan = async () => {
    if (!popover || !popover.activityId) return;
    const plannedMinutes = Math.max(1, popover.endMinute - popover.startMinute);
    setSaving(true);
    try {
      const isEdit = !!popover.id;
      const url = isEdit ? `${BACKEND}/api/v1/plans?id=${popover.id}` : `${BACKEND}/api/v1/plans`;
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: popover.activityId,
          date: format(currentDate, 'yyyy-MM-dd'),
          startMinute: popover.startMinute,
          plannedMinutes,
          memo: popover.memo,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updatedPlan = await res.json();
      if (isEdit) {
        setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      } else {
        setPlans(prev => [...prev, updatedPlan]);
      }
      setPopover(null);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${BACKEND}/api/v1/plans?id=${id}`, { method: 'DELETE' });
      setPlans(prev => prev.filter(p => p.id !== id));
    } catch (e) { console.error(e); }
  };

  const formatHour = (h: number) =>
    h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50/50">
      {/* Header */}
      <div className="p-6 md:px-10 md:pt-10 flex-shrink-0">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Action Plan</h1>
            <p className="text-slate-500 mt-2 text-lg">Click the timeline to add a plan block.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
            <div className="flex items-center bg-white p-1.5 rounded-sm shadow-sm border border-slate-100 justify-center">
              <button onClick={() => setScale(s => Math.max(SCALE_MIN, s - 0.25))} className="p-2 hover:bg-slate-50 rounded-sm transition-colors">
                <ZoomOut size={20} className="text-slate-600" />
              </button>
              <span className="w-16 text-center text-sm font-bold text-slate-700">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(SCALE_MAX, s + 0.25))} className="p-2 hover:bg-slate-50 rounded-sm transition-colors">
                <ZoomIn size={20} className="text-slate-600" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-white p-2 rounded-sm shadow-sm border border-slate-100 w-full sm:w-auto">
              <button onClick={() => setCurrentDate(d => subDays(d, 1))} className="p-3 hover:bg-slate-50 rounded-sm transition-colors text-slate-600">
                <ChevronLeft size={24} />
              </button>
              <div className="relative" ref={calendarRef}>
                <button
                  onClick={() => { setShowCalendar(v => !v); setCalendarMonth(currentDate); }}
                  className="flex items-center justify-center gap-2 font-bold text-lg text-slate-800 px-4 w-40 hover:text-indigo-600 transition-colors"
                >
                  <CalendarIcon size={20} className="text-indigo-500" />
                  {format(currentDate, 'MMM d')}
                </button>
                <AnimatePresence>
                  {showCalendar && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      className="absolute top-full mt-2 right-0 z-50 bg-white rounded-sm shadow-2xl border border-slate-100 p-4 w-72"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <button onClick={() => setCalendarMonth(m => subMonths(m, 1))} className="p-1.5 hover:bg-slate-100 rounded-sm"><ChevronLeft size={16} /></button>
                        <span className="font-bold text-slate-700 text-sm">{format(calendarMonth, 'MMMM yyyy')}</span>
                        <button onClick={() => setCalendarMonth(m => addMonths(m, 1))} className="p-1.5 hover:bg-slate-100 rounded-sm"><ChevronRight size={16} /></button>
                      </div>
                      <div className="grid grid-cols-7 mb-1">
                        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="text-center text-[11px] font-semibold text-slate-400 py-1">{d}</div>)}
                      </div>
                      <div className="grid grid-cols-7 gap-y-0.5">
                        {eachDayOfInterval({ start: startOfWeek(startOfMonth(calendarMonth)), end: endOfWeek(endOfMonth(calendarMonth)) }).map(day => (
                          <button
                            key={day.toISOString()}
                            onClick={() => { setCurrentDate(day); setShowCalendar(false); }}
                            className={`text-center text-xs py-1.5 rounded-sm font-medium transition-colors ${isSameDay(day, currentDate) ? 'bg-indigo-600 text-white' : isSameDay(day, now) ? 'bg-indigo-50 text-indigo-600 font-bold' : 'hover:bg-slate-100 text-slate-700'} ${!isSameMonth(day, calendarMonth) ? 'opacity-30' : ''}`}
                          >{format(day, 'd')}</button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button onClick={() => setCurrentDate(d => addDays(d, 1))} className="p-3 hover:bg-slate-50 rounded-sm transition-colors text-slate-600">
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Timeline grid */}
      <div className="flex-1 overflow-hidden px-6 md:px-10 pb-6 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <div ref={scrollRef} className="h-full w-full bg-white rounded-sm shadow-sm border border-slate-200 overflow-y-auto relative">
            <div className="relative min-w-[500px]" style={{ height: `${1440 * scale}px` }}>
              <div className="absolute inset-0 flex">
                <div className="w-20 sm:w-24 border-r border-slate-100 bg-slate-50/50 relative shrink-0">
                  {hours.map(h => (
                    <div key={`label-${h}`} className="absolute right-0 pr-3 sm:pr-4 text-slate-400 text-xs sm:text-sm font-semibold select-none -translate-y-1/2" style={{ top: `${h * 60 * scale}px` }}>
                      {formatHour(h)}
                    </div>
                  ))}
                </div>

                <div ref={gridRef} className="flex-1 relative cursor-crosshair" onClick={handleGridClick}>
                  {hours.map(h => <div key={`line-${h}`} className="absolute w-full border-t border-slate-100" style={{ top: `${h * 60 * scale}px` }} />)}

                  {isSameDay(currentDate, now) && (
                    <div className="absolute w-full flex items-center z-30 pointer-events-none" style={{ top: `${(now.getHours() * 60 + now.getMinutes()) * scale}px`, transform: 'translateY(-50%)' }}>
                      <div className="absolute right-[100%] mr-2 px-1.5 py-0.5 whitespace-nowrap bg-red-500 text-white text-[10px] font-bold rounded-sm shadow-sm">{format(now, 'HH:mm')}</div>
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-[5px] relative z-10" />
                      <div className="h-[2px] w-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
                    </div>
                  )}

                  <AnimatePresence>
                    {plans.map(plan => {
                      const act = activityMap[plan.activityId];
                      if (!act) return null;
                      const top = plan.startMinute * scale;
                      const height = Math.max(plan.plannedMinutes * scale, 14);
                      return (
                        <motion.div
                          key={plan.id}
                          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1, height: `${height}px` }} exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute left-1 right-1 rounded-sm border-l-4 overflow-hidden group cursor-pointer"
                          style={{ top: `${top}px`, borderColor: act.colorCode, backgroundColor: `${act.colorCode}22`, zIndex: 10 }}
                          onClick={e => {
                            e.stopPropagation();
                            const rect = gridRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            setPopover({
                              id: plan.id,
                              activityId: plan.activityId,
                              startMinute: plan.startMinute,
                              endMinute: plan.startMinute + plan.plannedMinutes,
                              memo: plan.memo,
                              x: e.clientX - rect.left,
                              y: plan.startMinute * scale,
                            });
                          }}
                        >
                          <div className="px-2 py-0.5 h-full flex items-center justify-between gap-2">
                             <span className="font-bold text-xs truncate" style={{ color: act.colorCode }}>{act.name}</span>
                             <button onClick={e => handleDelete(plan.id, e)} className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={12} /></button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  <AnimatePresence>
                    {popover && (
                      <motion.div
                        ref={popoverRef}
                        initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute z-50 bg-white rounded-sm shadow-2xl border border-slate-100 p-4 w-72"
                        style={{ top: Math.max(0, Math.min(popover.y, 1440 * scale - 300)), left: Math.min(popover.x + 16, 400) }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="mb-4">
                          <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Activity Memo</p>
                          <textarea 
                            value={popover.memo}
                            onChange={e => setPopover(p => p ? { ...p, memo: e.target.value } : p)}
                            placeholder="Add a note..."
                            className="w-full text-sm border rounded-sm px-2 py-1.5 focus:border-indigo-400 focus:outline-none min-h-[60px] resize-none"
                          />
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex-1">
                            <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Start</p>
                            <input type="time" value={minToTimeStr(popover.startMinute)} onChange={e => {
                              const sm = timeStrToMin(e.target.value);
                              setPopover(p => p ? { ...p, startMinute: sm, endMinute: Math.max(sm + 1, p.endMinute) } : p);
                            }} className="w-full text-sm font-bold border rounded-sm px-2 py-1.5 focus:border-indigo-400 focus:outline-none" />
                          </div>
                          <span className="text-slate-300 mt-5">→</span>
                          <div className="flex-1">
                            <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">End</p>
                            <input type="time" value={minToTimeStr(popover.endMinute)} onChange={e => {
                              const em = timeStrToMin(e.target.value);
                              setPopover(p => p ? { ...p, endMinute: Math.max(p.startMinute + 1, em) } : p);
                            }} className="w-full text-sm font-bold border rounded-sm px-2 py-1.5 focus:border-indigo-400 focus:outline-none" />
                          </div>
                        </div>

                        <div className="mb-4">
                          <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1.5 tracking-wide">Quick duration</p>
                          <div className="flex flex-wrap gap-1.5">
                            {DURATION_PRESETS.map(mins => (
                              <button key={mins} onClick={() => setPopover(p => p ? { ...p, endMinute: Math.min(1440, p.startMinute + mins) } : p)} className={`text-xs px-2 py-1 rounded-sm font-bold border transition-all ${(popover.endMinute - popover.startMinute) === mins ? 'bg-indigo-600 text-white border-transparent' : 'border-slate-200 text-slate-600 hover:border-indigo-300'}`}>{mins >= 60 ? `${mins / 60}h` : `${mins}m`}</button>
                            ))}
                          </div>
                        </div>

                        <div className="mb-4">
                          <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1.5 tracking-wide">Activity</p>
                          <div className="flex flex-wrap gap-1.5">
                            {activities.map(act => (
                              <button key={act.id} onClick={() => setPopover(p => p ? { ...p, activityId: act.id } : p)} className={`text-xs px-2 py-1 rounded-sm font-semibold border transition-all ${popover.activityId === act.id ? 'text-white border-transparent' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`} style={popover.activityId === act.id ? { backgroundColor: act.colorCode } : {}}>{act.name}</button>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setPopover(null)} className="text-xs text-slate-500 px-2 py-1 hover:text-slate-700 transition-colors">Cancel</button>
                          <button onClick={handleSavePlan} disabled={saving} className="text-xs px-3 py-1.5 bg-slate-900 text-white rounded-sm font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors">{saving ? '…' : popover.id ? 'Update' : 'Add'}</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
