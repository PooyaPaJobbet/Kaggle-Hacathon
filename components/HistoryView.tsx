import React, { useEffect, useState } from 'react';
import { ValidationProject } from '../types';
import { getHistory } from '../services/db';
import { CheckCircle2, Clock, FileText, ChevronRight, Search, AlertTriangle, XCircle } from 'lucide-react';

interface HistoryViewProps {
  onSelectProject: (project: ValidationProject) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ onSelectProject }) => {
  const [history, setHistory] = useState<ValidationProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await getHistory();
      setHistory(data);
    } catch (e) {
      console.error("Failed to load history", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <div className="animate-spin mr-2 h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
        Loading history...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Validation History</h1>
          <p className="text-slate-500 mt-1">Archive of all past validation runs and versions.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {history.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>No validation history found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">Project Name</th>
                  <th className="px-6 py-4 font-medium">Platform Version</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Results</th>
                  <th className="px-6 py-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((project) => {
                   const passed = project.testCases.filter(tc => tc.status === 'PASSED').length;
                   const total = project.testCases.length;
                   
                   return (
                    <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{project.name}</td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                          v{project.platformVersion}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(project.createdAt).toLocaleDateString()}
                        <div className="text-xs text-slate-400">{new Date(project.createdAt).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          project.status === 'Validated' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : project.status === 'Failed'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : project.status === 'Partly Validated'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}>
                          {project.status === 'Validated' && <CheckCircle2 className="w-3 h-3"/>}
                          {project.status === 'Partly Validated' && <AlertTriangle className="w-3 h-3"/>}
                          {project.status === 'Failed' && <XCircle className="w-3 h-3"/>}
                          {project.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                         {total > 0 ? (
                           <span>{passed}/{total} Passed</span>
                         ) : (
                           <span className="text-slate-400">-</span>
                         )}
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => onSelectProject(project)}
                          className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                        >
                          View <ChevronRight className="w-4 h-4"/>
                        </button>
                      </td>
                    </tr>
                   );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryView;