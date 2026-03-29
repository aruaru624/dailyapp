"use client";

import { useCallback, useEffect, useState } from 'react';
import { activityClient } from '@/api/client';
import { Activity, ActivityLog } from '@/gen/activity/v1/activity_pb';
import { motion } from 'framer-motion';
import { Play, Square } from 'lucide-react';

export default function HomePage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeLogs, setActiveLogs] = useState<Record<string, ActivityLog>>({});
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000); // update every 1s
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await activityClient.listActivities({});
      setActivities(res.activities);
      
      const today = new Date().toISOString().split('T')[0];
      const logRes = await activityClient.getDailyLogs({ date: today });
      
      const active: Record<string, ActivityLog> = {};
      logRes.logs.forEach(log => {
        if (!log.endTime) {
          active[log.activityId] = log;
        }
      });
      setActiveLogs(active);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const overrideActiveLog = (activityId: string, log: ActivityLog | null) => {
    setActiveLogs(prev => {
      const next = { ...prev };
      if (log) {
        next[activityId] = log;
      } else {
        delete next[activityId];
      }
      return next;
    });
  };

  const tsToDate = (ts: any) => {
    if (!ts) return undefined;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (ts.seconds !== undefined) return new Date(Number(ts.seconds) * 1000 + (ts.nanos || 0) / 1e6);
    return undefined;
  };

  const formatDuration = (startTimeTs: any) => {
    const start = tsToDate(startTimeTs);
    if (!start) return '00:00:00';
    const diff = now.getTime() - start.getTime();
    
    const secs = Math.floor(diff / 1000);
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remainingSecs = secs % 60;
    
    const h = String(hrs).padStart(2, '0');
    const m = String(mins).padStart(2, '0');
    const s = String(remainingSecs).padStart(2, '0');
    
    return `${h}:${m}:${s}`;
  };

  const toggleActivity = async (activity: Activity) => {
    const isActive = !!activeLogs[activity.id];
    try {
      if (isActive) {
        // stop
        await activityClient.stopActivity({ activityId: activity.id });
        overrideActiveLog(activity.id, null);
      } else {
        // start
        const res = await activityClient.recordActivity({ activityId: activity.id });
        if (res.log) {
          overrideActiveLog(activity.id, res.log);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 md:p-12 w-full h-full flex flex-col">
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Today</h1>
        <p className="text-slate-500 mt-2 text-lg">What are you working on?</p>
      </header>
      
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center px-4">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
            <Play className="text-slate-400 w-12 h-12 ml-2" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-slate-800">No Activities</h2>
          <p className="text-slate-500 text-base max-w-sm">Go to settings to create your tracking buttons.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 auto-rows-[160px]">
          {activities.map(act => {
            const isActive = !!activeLogs[act.id];
            
            return (
              <motion.button
                key={act.id}
                whileTap={{ scale: 0.96 }}
                whileHover={{ y: -4 }}
                onClick={() => toggleActivity(act)}
                className={`relative overflow-hidden rounded-[2rem] p-6 flex flex-col justify-between items-start text-left transition-all duration-300 ${
                  isActive 
                    ? 'ring-4 ring-offset-4 shadow-xl' 
                    : 'shadow-sm hover:shadow-xl bg-white border border-slate-100'
                }`}
                style={{ 
                  backgroundColor: isActive ? act.colorCode : '#ffffff',
                  borderColor: isActive ? 'transparent' : `${act.colorCode}20`,
                  boxShadow: isActive
                    ? `0 20px 25px -5px ${act.colorCode}60, 0 0 0 4px white, 0 0 0 8px ${act.colorCode}`
                    : undefined,
                }}
              >
                {isActive && (
                  <motion.div 
                    layoutId="active-wave"
                    className="absolute inset-0 opacity-10 bg-black"
                  ></motion.div>
                )}
                
                <div className={`p-4 rounded-3xl shrink-0 transition-colors duration-300 ${isActive ? 'bg-black/20 text-white' : 'text-slate-600'}`} style={{ backgroundColor: !isActive ? `${act.colorCode}15` : undefined, color: !isActive ? act.colorCode : undefined }}>
                  {isActive ? <Square size={26} fill="currentColor" /> : <Play size={26} className="ml-1" fill="currentColor" />}
                </div>
                
                <div className="z-10 mt-auto w-full">
                  <h3 className={`font-bold text-xl truncate ${isActive ? 'text-white' : 'text-slate-800'}`}>
                    {act.name}
                  </h3>
                  <p className={`text-sm mt-1 font-semibold ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                    {isActive ? formatDuration(activeLogs[act.id].startTime) : 'Tap to start'}
                  </p>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  );
}
