"use client";

import { useCallback, useEffect, useState } from 'react';
import { activityClient } from '@/api/client';
import { Activity } from '@/gen/activity/v1/activity_pb';
import { Plus, Trash2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
  '#14b8a6', '#8b5cf6', '#f43f5e', '#10b981'
];

export default function SettingsPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await activityClient.listActivities({});
      setActivities(res.activities);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await activityClient.createActivity({
        name: newName,
        colorCode: newColor,
      });
      if (res.activity) {
        setActivities([...activities, res.activity]);
      }
      setIsAdding(false);
      setNewName('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete '${name}'?`)) return;
    try {
      await activityClient.deleteActivity({ id });
      setActivities(activities.filter(a => a.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 md:p-10 w-full h-full flex flex-col min-h-screen bg-white">
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-2 text-lg">Manage your tracking buttons.</p>
      </header>

      <div className="flex-1 max-w-3xl w-full">
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              className="bg-slate-50/80 p-6 md:p-8 rounded-[2rem] shadow-inner border border-slate-100 mb-8 overflow-hidden"
            >
              <h3 className="font-extrabold text-slate-800 text-2xl mb-6">Create New Button</h3>
              <div className="mb-6">
                <label className="block text-base font-bold text-slate-700 mb-3">Activity Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Reading, Coding, Workout"
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 text-slate-900 font-bold text-lg bg-white shadow-sm transition-all"
                />
              </div>
              <div className="mb-8">
                <label className="block text-base font-bold text-slate-700 mb-3">Color Label</label>
                <div className="flex flex-wrap gap-3">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-sm ${newColor === c ? 'scale-110 ring-4 ring-offset-4 ring-slate-800 shadow-md' : 'hover:scale-110 hover:shadow-md'}`}
                      style={{ backgroundColor: c }}
                    >
                      {newColor === c && <Check size={24} className="text-white drop-shadow-md" />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 justify-end">
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-6 py-3 rounded-2xl text-slate-600 font-bold bg-white border-2 border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="px-8 py-3 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Done
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-extrabold text-slate-800">Your Activities</h2>
          {!isAdding && (
            <motion.button
              whileHover={{ scale: 1.05, rotate: 90 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsAdding(true)}
              className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl flex items-center justify-center hover:bg-slate-800 transition-colors"
            >
              <Plus size={28} />
            </motion.button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900"></div>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center p-12 bg-slate-50 rounded-[2rem] border-2 border-slate-200 border-dashed">
            <p className="text-slate-500 font-bold text-lg">No activities created yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {activities.map(act => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={act.id}
                  className="bg-white p-5 rounded-3xl flex items-center justify-between border-2 border-slate-100 shadow-sm hover:shadow-lg transition-all"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-[1.25rem] shadow-inner" style={{ backgroundColor: act.colorCode }} />
                    <h3 className="font-extrabold text-slate-800 text-lg truncate pr-2">{act.name}</h3>
                  </div>
                  <button
                    onClick={() => handleDelete(act.id, act.name)}
                    className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-colors"
                  >
                    <Trash2 size={24} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
