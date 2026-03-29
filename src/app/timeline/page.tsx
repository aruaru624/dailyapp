"use client";

import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { activityClient } from '@/api/client';
import { Activity, ActivityLog } from '@/gen/activity/v1/activity_pb';
import { format, subDays, addDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, getMonth, getYear, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, ZoomIn, ZoomOut, StickyNote, Save } from 'lucide-react';
import { apiUrl } from '@/api/url';
import { motion, AnimatePresence } from 'framer-motion';

interface DailyPlan {
  id: string;
  activityId: string;
  date: string;
  startMinute: number;
  plannedMinutes: number;
  memo: string;
}

export default function TimelinePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activities, setActivities] = useState<Record<string, Activity>>({});
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [showPlan, setShowPlan] = useState(true);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [scale, setScale] = useState(1);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const calendarRef = useRef<HTMLDivElement>(null);
  
  const [selectedLog, setSelectedLog] = useState<{ log: any; act: Activity; isOngoing: boolean; start: Date; end: Date; durationMins: number } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const actRes = await activityClient.listActivities({});
      const actMap: Record<string, Activity> = {};
      actRes.activities.forEach(a => actMap[a.id] = a);
      setActivities(actMap);

      const dateStr = format(currentDate, 'yyyy-MM-dd');
      
      // Fetch actual logs
      const logRes = await activityClient.getDailyLogs({ date: dateStr });
      setLogs(logRes.logs);

      // Fetch plans
      const planRes = await fetch(apiUrl(`/api/v1/plans?date=${dateStr}`));
      const planData = await planRes.json();
      setPlans(planData ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!loading && isSameDay(currentDate, new Date()) && scrollContainerRef.current) {
      const top = (now.getHours() * 60 + now.getMinutes()) * scale;
      scrollContainerRef.current.scrollTop = Math.max(0, top - 200);
    }
  }, [loading, currentDate, scale, now]);

  const handlePrevDay = () => setCurrentDate(prev => subDays(prev, 1));
  const handleNextDay = () => setCurrentDate(prev => addDays(prev, 1));

  // Close calendar on outside click
  useEffect(() => {
    if (!showCalendar) return;
    const handler = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCalendar]);

  const handlePickDate = (d: Date) => {
    setCurrentDate(d);
    setShowCalendar(false);
  };

  const tsToDate = (ts: any) => {
    if (!ts) return undefined;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (ts.seconds !== undefined) return new Date(Number(ts.seconds) * 1000 + (ts.nanos || 0) / 1e6);
    return undefined;
  };

  const formatTime = (ts: any) => {
    const d = tsToDate(ts);
    if (!d) return '--:--';
    return format(d, 'HH:mm');
  };

  const handleUpdateMemo = async (id: string, newMemo: string) => {
    try {
      await activityClient.updateActivityLog({ id, memo: newMemo });
      setLogs(prev => prev.map(l => l.id === id ? { ...l, memo: newMemo } : l));
      if (selectedLog && selectedLog.log.id === id) {
        setSelectedLog({ ...selectedLog, log: { ...selectedLog.log, memo: newMemo } });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const isToday = isSameDay(currentDate, now);

  const placedLogs = useMemo(() => {
    if (!logs.length || Object.keys(activities).length === 0) return [];

    const processed = logs.map(log => {
      const act = activities[log.activityId];
      if (!act) return null;

      const start = tsToDate(log.startTime);
      if (!start) return null;

      let end = tsToDate(log.endTime);
      const isOngoing = !log.endTime;
      
      if (!end) {
        end = isToday ? now : new Date(new Date(currentDate).setHours(23, 59, 59, 999));
      }

      let startMins = start.getHours() * 60 + start.getMinutes();
      let endMins = end.getHours() * 60 + end.getMinutes();
      
      if (end < start) endMins = 1440;

      let durationMins = endMins - startMins;
      let height = Math.max(durationMins * scale, 14);
      
      let layoutEndMins = startMins + Math.max(durationMins, 14 / scale);

      return { log, act, start, end, startMins, endMins, layoutEndMins, height, durationMins, isOngoing, column: 0, totalColumns: 1 };
    }).filter(Boolean) as any[];

    processed.sort((a, b) => {
      if (a.startMins !== b.startMins) return a.startMins - b.startMins;
      return b.layoutEndMins - a.layoutEndMins;
    });

    const groups: typeof processed[] = [];
    let currentGroup: typeof processed = [];
    let groupEnd = -1;

    for (const p of processed) {
      if (currentGroup.length === 0) {
        currentGroup.push(p);
        groupEnd = p.layoutEndMins;
      } else if (p.startMins < groupEnd) {
        currentGroup.push(p);
        groupEnd = Math.max(groupEnd, p.layoutEndMins);
      } else {
        groups.push(currentGroup);
        currentGroup = [p];
        groupEnd = p.layoutEndMins;
      }
    }
    if (currentGroup.length > 0) groups.push(currentGroup);

    const finalPlaced: any[] = [];

    for (const group of groups) {
      const columnsEndTimes: number[] = [];
      for (const p of group) {
        let placed = false;
        for (let i = 0; i < columnsEndTimes.length; i++) {
          if (columnsEndTimes[i] <= p.startMins) {
            p.column = i;
            columnsEndTimes[i] = p.layoutEndMins;
            placed = true;
            break;
          }
        }
        if (!placed) {
          p.column = columnsEndTimes.length;
          columnsEndTimes.push(p.layoutEndMins);
        }
      }
      
      for (const p of group) {
        p.totalColumns = columnsEndTimes.length;
        finalPlaced.push(p);
      }
    }

    return finalPlaced;
  }, [logs, activities, currentDate, isToday, now, scale]);

  return (
    <div className="flex flex-col h-screen bg-slate-50/50">
      <div className="p-6 md:px-10 md:pt-10 flex-shrink-0">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Timeline</h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:justify-end">
              <button 
                onClick={() => setShowPlan(v => !v)} 
                className={`p-2 rounded-sm transition-all flex items-center gap-2 border flex-shrink-0 ${showPlan ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'}`}
                title={showPlan ? "Hide Plan" : "Show Plan"}
              >
                <Clock size={18} className={showPlan ? 'text-indigo-600' : 'text-slate-400'} />
                <span className="text-xs">Plan</span>
              </button>

              <div className="flex items-center bg-white p-1.5 rounded-sm shadow-sm border border-slate-100 shrink-0 justify-center">
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-2 hover:bg-slate-50 rounded-sm transition-colors">
                <ZoomOut size={20} className="text-slate-600" />
              </button>
              <span className="w-12 text-center text-sm font-bold text-slate-700">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-2 hover:bg-slate-50 rounded-sm transition-colors">
                <ZoomIn size={20} className="text-slate-600" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-white p-2 rounded-sm shadow-sm border border-slate-100 shrink-0">
              <button onClick={handlePrevDay} className="p-2 hover:bg-slate-50 rounded-sm transition-colors">
                <ChevronLeft size={20} className="text-slate-600" />
              </button>
              <div className="relative" ref={calendarRef}>
                <button
                  onClick={() => { setShowCalendar(v => !v); setCalendarMonth(currentDate); }}
                  className="flex items-center justify-center gap-2 font-bold text-base text-slate-800 whitespace-nowrap px-2 w-32 hover:text-indigo-600 transition-colors"
                >
                  <CalendarIcon size={18} className="text-indigo-500" />
                  {format(currentDate, 'MMM d')}
                </button>

                <AnimatePresence>
                  {showCalendar && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      className="absolute top-full mt-2 right-0 z-50 bg-white rounded-sm shadow-2xl border border-slate-100 p-4 w-72"
                    >
                      {/* Month navigation */}
                      <div className="flex items-center justify-between mb-3">
                        <button onClick={() => setCalendarMonth(m => subMonths(m, 1))} className="p-1.5 hover:bg-slate-100 rounded-sm transition-colors">
                          <ChevronLeft size={16} className="text-slate-600" />
                        </button>
                        <span className="font-bold text-slate-700 text-sm">{format(calendarMonth, 'MMMM yyyy')}</span>
                        <button onClick={() => setCalendarMonth(m => addMonths(m, 1))} className="p-1.5 hover:bg-slate-100 rounded-sm transition-colors">
                          <ChevronRight size={16} className="text-slate-600" />
                        </button>
                      </div>

                      {/* Weekday headers */}
                      <div className="grid grid-cols-7 mb-1">
                        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                          <div key={d} className="text-center text-[11px] font-semibold text-slate-400 py-1">{d}</div>
                        ))}
                      </div>

                      {/* Day grid */}
                      <div className="grid grid-cols-7 gap-y-0.5">
                        {eachDayOfInterval({
                          start: startOfWeek(startOfMonth(calendarMonth)),
                          end: endOfWeek(endOfMonth(calendarMonth))
                        }).map(day => {
                          const isSelected = isSameDay(day, currentDate);
                          const isThisMonth = isSameMonth(day, calendarMonth);
                          const isNow = isSameDay(day, now);
                          return (
                            <button
                              key={day.toISOString()}
                              onClick={() => handlePickDate(day)}
                              className={`text-center text-xs py-1.5 rounded-sm font-medium transition-colors
                                ${ isSelected ? 'bg-indigo-600 text-white' : isNow ? 'bg-indigo-50 text-indigo-600 font-bold' : 'hover:bg-slate-100 text-slate-700' }
                                ${ !isThisMonth ? 'opacity-30' : '' }
                              `}
                            >
                              {format(day, 'd')}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button onClick={handleNextDay} className="p-3 hover:bg-slate-50 rounded-sm transition-colors">
                <ChevronRight size={24} className="text-slate-600" />
              </button>
            </div>
          </div>
        </header>
      </div>

      <div className="flex-1 overflow-hidden px-6 md:px-10 pb-6 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div 
            ref={scrollContainerRef}
            className="h-full w-full bg-white rounded-sm shadow-sm border border-slate-200 overflow-y-auto relative"
          >
            <div className="relative min-w-[600px]" style={{ height: `${1440 * scale}px` }}>
              <div className="absolute inset-0 flex">
                
                <div className="w-20 sm:w-24 border-r border-slate-100 bg-slate-50/50 relative shrink-0">
                  {hours.map(h => (
                    <div 
                      key={`label-${h}`} 
                      className="absolute right-0 pr-3 sm:pr-4 text-slate-400 text-xs sm:text-sm font-semibold select-none -translate-y-1/2" 
                      style={{ top: `${h * 60 * scale}px` }}
                    >
                      {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                    </div>
                  ))}
                </div>

                <div className={`flex-1 relative ${showPlan ? 'flex' : ''}`}>
                  {/* Plan Column */}
                  {showPlan && (
                    <div className="w-24 sm:w-32 border-r border-slate-100 bg-slate-50/20 relative shrink-0">
                      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-slate-100 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center shadow-sm">Plan</div>
                      <AnimatePresence>
                        {plans.map(plan => {
                          const act = activities[plan.activityId];
                          if (!act) return null;
                          const top = plan.startMinute * scale;
                          const height = Math.max(plan.plannedMinutes * scale, 14);
                          return (
                            <motion.div
                              key={plan.id}
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="absolute left-1.5 right-1.5 rounded-sm border border-dashed bg-white/50 flex flex-col justify-center px-2 overflow-hidden"
                              style={{ top: `${top}px`, height: `${height}px`, borderColor: act.colorCode, borderLeftWidth: '3px', zIndex: 5 }}
                              onClick={() => setSelectedLog({ log: plan, act, isOngoing: false, start: new Date(), end: new Date(), durationMins: plan.plannedMinutes })}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-bold truncate opacity-70" style={{ color: act.colorCode }}>{act.name}</span>
                                {plan.memo && <StickyNote size={8} className="opacity-40" style={{ color: act.colorCode }} />}
                              </div>
                              {height > 30 && <span className="text-[8px] opacity-40 font-bold" style={{ color: act.colorCode }}>{plan.plannedMinutes}m</span>}
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Actual Column */}
                  <div className="flex-1 relative">
                    {showPlan && (
                      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-slate-100 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center shadow-sm">Actual</div>
                    )}
                    {/* Hour lines */}
                    {hours.map(h => (
                      <div 
                        key={`line-${h}`} 
                        className="absolute w-full border-t border-slate-100" 
                        style={{ top: `${h * 60 * scale}px` }} 
                      />
                    ))}
                    
                    {isToday && (
                      <div 
                        className="absolute w-full flex items-center z-30 pointer-events-none" 
                        style={{ top: `${(now.getHours() * 60 + now.getMinutes()) * scale}px`, transform: 'translateY(-50%)' }}
                      >
                        <div className="absolute right-[100%] mr-2 px-1.5 py-0.5 whitespace-nowrap bg-red-500 text-white text-[10px] font-bold rounded shadow-sm">
                          {format(now, 'HH:mm')}
                        </div>
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-[5px] relative z-10"></div>
                        <div className="h-[2px] w-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]"></div>
                      </div>
                    )}

                    <AnimatePresence>
                      {placedLogs.map((p) => {
                        const { log, act, start, end, startMins, height, durationMins, isOngoing, column, totalColumns } = p;
                        
                        const widthPct = 100 / totalColumns;
                        const leftPct = column * widthPct;

                        return (
                          <motion.div
                            key={log.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1, height: `${height}px` }}
                            className="absolute rounded-sm border-l-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow overflow-hidden group cursor-pointer"
                            style={{
                              top: `${startMins * scale}px`,
                              left: `calc(${leftPct}% + 4px)`,
                              width: `calc(${widthPct}% - 8px)`,
                              borderColor: act.colorCode,
                              backgroundColor: `${act.colorCode}1A`,
                              zIndex: isOngoing ? 20 : 10
                            }}
                            onClick={() => setSelectedLog({ log, act, isOngoing, start, end, durationMins })}
                          >
                            <div className="px-1.5 sm:px-2 py-0.5 h-full w-full flex flex-col justify-start">
                               <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-1 xl:gap-2">
                                 <div className="flex items-center gap-1.5 truncate">
                                   <h3 className="font-extrabold text-slate-800 text-xs sm:text-sm truncate" style={{ color: act.colorCode }}>
                                     {act.name}
                                   </h3>
                                   {log.memo && <StickyNote size={10} className="opacity-60" style={{ color: act.colorCode }} />}
                                 </div>
                                 {height > 35 && (
                                   <p className="text-[10px] sm:text-xs font-semibold opacity-80 shrink-0 truncate" style={{ color: act.colorCode }}>
                                     {formatTime(log.startTime)} - {isOngoing ? 'Now' : formatTime(log.endTime)}
                                   </p>
                                 )}
                               </div>
                               {height > 45 && (
                               <div className="mt-0.5 flex items-center gap-1.5 text-[10px] sm:text-xs font-medium opacity-70" style={{ color: act.colorCode }}>
                                 {isOngoing ? (
                                   <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-current animate-pulse"/> Tracking</span>
                                 ) : (
                                   <span>{Math.round(durationMins)} mins</span>
                                 )}
                               </div>
                             )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </div>
            
            {logs.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-slate-500 pointer-events-none z-40">
                <Clock className="w-16 h-16 mb-5 text-slate-300" />
                <p className="text-xl font-bold text-slate-700">No activity recorded</p>
                <p className="text-slate-400 mt-1">Select another date to view history.</p>
              </div>
            )}
            
            </div>
          </div>
        )}
      </div>

      {/* Selected Log Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-sm p-6 w-full max-w-sm shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedLog(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <span className="sr-only">Close</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: selectedLog.act.colorCode }}></div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800">{selectedLog.act.name}</h2>
                  <p className="text-sm font-semibold text-slate-500">
                     {selectedLog.isOngoing ? 'Currently Tracking' : 'Completed Session'}
                  </p>
                </div>
              </div>

              <div className="space-y-4 bg-slate-50 p-4 rounded-sm border border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm font-medium">Start</span>
                  <span className="text-slate-800 font-bold">{format(selectedLog.start, 'HH:mm')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm font-medium">End</span>
                  <span className="text-slate-800 font-bold">{selectedLog.isOngoing ? 'Now' : format(selectedLog.end, 'HH:mm')}</span>
                </div>
                <div className="h-px w-full bg-slate-200"></div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm font-medium">Duration</span>
                  <span className="text-indigo-600 font-bold">{Math.round(selectedLog.durationMins)} mins</span>
                </div>
              </div>
              
              <div className="mt-6">
                <p className="text-[10px] uppercase font-semibold text-slate-400 mb-2">Memo</p>
                {/* Only allow editing ActivityLog, not DailyPlan in this view for now */}
                {selectedLog.log.activityId ? (
                   <div className="relative group">
                     <textarea 
                       value={selectedLog.log.memo || ''}
                       onChange={(e) => {
                         // Instant update for UI feeling, but wait for save or blur?
                         // For simplicity, we'll implement a debounced or manual save.
                         // Let's use a manual save button for now.
                         const val = e.target.value;
                         setSelectedLog({ ...selectedLog, log: { ...selectedLog.log, memo: val } });
                       }}
                       placeholder="Add a note..."
                       className="w-full text-sm bg-slate-50 border border-slate-100 rounded-sm px-3 py-2 focus:border-indigo-400 focus:outline-none min-h-[80px] resize-none pr-8"
                     />
                     <button 
                        onClick={() => handleUpdateMemo(selectedLog.log.id, selectedLog.log.memo)}
                        className="absolute bottom-2 right-2 p-1.5 bg-indigo-600 text-white rounded-full shadow-lg opacity-0 group-focus-within:opacity-100 transition-opacity"
                        title="Save Memo"
                     >
                       <Save size={14} />
                     </button>
                   </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-sm italic text-slate-500 text-sm border border-slate-100 italic">
                    {selectedLog.log.memo || 'No notes for this plan.'}
                  </div>
                )}
              </div>
              
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
