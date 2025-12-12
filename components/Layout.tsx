
import React, { ReactNode } from 'react';
import { ShieldCheck, LayoutDashboard, PlusCircle, History } from 'lucide-react';
import { AppView } from '../types';

interface LayoutProps {
  children: ReactNode;
  currentView: AppView;
  onChangeView: (view: AppView) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentView, onChangeView }) => {
  const navItemClass = (active: boolean) => 
    `flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
      active 
        ? 'bg-indigo-50 text-indigo-600' 
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden print:h-auto print:overflow-visible print:block print:bg-white">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-10 print:hidden">
        <div className="p-6 flex items-center gap-2 border-b border-slate-100">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900">ValidAI</span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <div 
            onClick={() => onChangeView(AppView.DASHBOARD)} 
            className={navItemClass(currentView === AppView.DASHBOARD)}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </div>
          
          <div className="pt-4 pb-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Validation Actions
          </div>

          <div 
            onClick={() => onChangeView(AppView.GATHER_REQUIREMENTS)}
            className={navItemClass([AppView.GATHER_REQUIREMENTS, AppView.REVIEW_PLAN, AppView.EXECUTION, AppView.REPORT].includes(currentView))}
          >
            <PlusCircle className="w-5 h-5" />
            New Validation
          </div>

          <div 
            onClick={() => onChangeView(AppView.HISTORY)}
            className={navItemClass(currentView === AppView.HISTORY)}
          >
            <History className="w-5 h-5" />
            History
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-xs font-medium text-slate-500 mb-1">Cloud Agent Status</div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs text-slate-700 font-semibold">Online & Ready</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-400">
              Storage: IndexedDB (NoSQL)
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative flex flex-col print:overflow-visible print:h-auto print:block print:w-full">
        {children}
      </main>
    </div>
  );
};

export default Layout;
