"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Settings, ListTodo } from 'lucide-react';
import { motion } from 'framer-motion';

const navItems = [
  { href: '/', icon: Home, label: 'Today' },
  { href: '/timeline', icon: Calendar, label: 'Timeline' },
  { href: '/plan', icon: ListTodo, label: 'Plan' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 px-6 py-3 flex justify-between items-center shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="relative flex flex-col items-center p-2">
              <Icon className={`w-6 h-6 z-10 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span className={`text-[10px] z-10 mt-1 font-medium ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-pill"
                  className="absolute inset-0 bg-indigo-50 rounded-xl"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Desktop Nav */}
      <nav className="hidden md:flex flex-col w-24 border-l border-slate-100 bg-white items-center py-8 gap-8 shrink-0 shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-10">
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-indigo-200">
          D
        </div>
        <div className="flex flex-col gap-6 w-full px-4 mt-8">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="relative flex flex-col items-center justify-center p-3 h-20 rounded-2xl w-full group">
                <Icon className={`w-7 h-7 z-10 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span className={`text-[11px] z-10 mt-2 font-semibold transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="desktop-nav-pill"
                    className="absolute inset-0 bg-indigo-50 rounded-2xl"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
