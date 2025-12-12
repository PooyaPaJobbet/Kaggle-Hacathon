import React, { useState, useRef } from 'react';
import Layout from './components/Layout';
import ChatInterface from './components/ChatInterface';
import TestPlanView from './components/TestPlanView';
import ExecutionRunner from './components/ExecutionRunner';
import ReportView from './components/ReportView';
import HistoryView from './components/HistoryView';
import { AppView, ValidationProject } from './types';
import { PlusCircle, FileSpreadsheet, CheckCircle2, UploadCloud, AlertTriangle, XCircle } from 'lucide-react';
import { saveProjectToHistory } from './services/db';
import { parseExcelRequirements } from './services/excelService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [activeProject, setActiveProject] = useState<ValidationProject | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStartNew = () => {
    setCurrentView(AppView.GATHER_REQUIREMENTS);
  };

  const handleRequirementsGathered = (data: Partial<ValidationProject>) => {
    const newProject: ValidationProject = {
      id: `PROJ-${Date.now()}`,
      name: data.name || "Untitled Project",
      platformVersion: data.platformVersion || "1.0.0",
      status: 'Draft',
      createdAt: new Date().toISOString(),
      requirements: data.requirements || [],
      testCases: [],
      chatHistory: data.chatHistory || []
    };
    setActiveProject(newProject);
    saveProjectToHistory(newProject); // Initial Save
    setCurrentView(AppView.REVIEW_PLAN);
  };

  const handleUpdateProject = (updated: ValidationProject) => {
    setActiveProject(updated);
    saveProjectToHistory(updated); // Save on update
  };

  const handleStartExecution = () => {
    setCurrentView(AppView.EXECUTION);
    if (activeProject) {
        handleUpdateProject({...activeProject, status: 'In Progress'});
    }
  };

  const handleExecutionComplete = () => {
    setCurrentView(AppView.REPORT);
  };

  const handleRetryExecution = () => {
      // Navigate back to execution view
      setCurrentView(AppView.EXECUTION);
  };

  const handleHistorySelect = (project: ValidationProject) => {
      setActiveProject(project);
      // Determine view based on status
      if (project.status === 'Draft' && project.testCases.length === 0) {
          setCurrentView(AppView.REVIEW_PLAN);
      } else if (['Validated', 'Failed', 'Partly Validated'].includes(project.status)) {
          setCurrentView(AppView.REPORT);
      } else {
          setCurrentView(AppView.REVIEW_PLAN);
      }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const file = e.target.files[0];
        const { requirements, name } = await parseExcelRequirements(file);
        
        const newProject: ValidationProject = {
            id: `PROJ-IMPORT-${Date.now()}`,
            name: name,
            platformVersion: "1.0.0", // Default, user can edit later
            status: 'Draft',
            createdAt: new Date().toISOString(),
            requirements: requirements,
            testCases: [],
            chatHistory: [] // No chat history for imports
        };

        setActiveProject(newProject);
        saveProjectToHistory(newProject);
        setCurrentView(AppView.REVIEW_PLAN);
      } catch (err) {
        console.error(err);
        alert("Error parsing Excel file. Please ensure it has columns like 'Description', 'Type', 'Priority'.");
      }
    }
  };

  const renderDashboard = () => (
    <div className="p-12 max-w-5xl mx-auto">
      <div className="text-center mb-16 space-y-4">
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Validation, Autopilot.</h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
          ValidAI autonomously gathers requirements, plans test cases, and executes validations on simulated cloud infrastructure.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div 
          onClick={handleStartNew}
          className="group bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-md p-8 rounded-2xl cursor-pointer transition-all text-center flex flex-col items-center justify-center min-h-[240px]"
        >
          <div className="w-16 h-16 bg-indigo-50 group-hover:bg-indigo-100 rounded-full flex items-center justify-center mb-6 transition-colors">
            <PlusCircle className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">New Validation Project</h3>
          <p className="text-slate-500 text-sm px-8">Start a chat with the agent to define requirements and generate a test plan.</p>
        </div>

        <div 
            onClick={triggerFileUpload}
            className="group bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md p-8 rounded-2xl cursor-pointer transition-all text-center flex flex-col items-center justify-center min-h-[240px]"
        >
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
            />
            <div className="w-16 h-16 bg-emerald-50 group-hover:bg-emerald-100 rounded-full flex items-center justify-center mb-6 transition-colors">
                <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Import from Excel</h3>
            <p className="text-slate-500 text-sm px-8 text-center">Upload structured requirements (.xlsx) to skip the chat phase.</p>
        </div>
      </div>

      {activeProject && activeProject.status !== 'Draft' && (
         <div className="mt-12">
            <h3 className="font-bold text-slate-800 mb-4">Recent Activity</h3>
            <div onClick={() => setCurrentView(AppView.REPORT)} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                        activeProject.status === 'Validated' ? 'bg-emerald-100' : 
                        activeProject.status === 'Failed' ? 'bg-red-100' :
                        'bg-amber-100'
                    }`}>
                        {activeProject.status === 'Validated' ? <CheckCircle2 className="w-6 h-6 text-emerald-600"/> :
                         activeProject.status === 'Failed' ? <XCircle className="w-6 h-6 text-red-600"/> :
                         <AlertTriangle className="w-6 h-6 text-amber-600"/>}
                    </div>
                    <div>
                        <div className="font-semibold text-slate-800">{activeProject.name}</div>
                        <div className="text-xs text-slate-500">Executed on {new Date(activeProject.createdAt).toLocaleDateString()}</div>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                         <div className="text-xs font-bold text-slate-500 uppercase">Status</div>
                         <div className={`text-sm font-semibold ${
                             activeProject.status === 'Validated' ? 'text-emerald-600' :
                             activeProject.status === 'Failed' ? 'text-red-600' :
                             activeProject.status === 'Partly Validated' ? 'text-amber-600' :
                             'text-slate-700'
                         }`}>{activeProject.status}</div>
                    </div>
                     <div className="text-right">
                         <div className="text-xs font-bold text-slate-500 uppercase">Version</div>
                         <div className="text-sm font-semibold text-slate-700">{activeProject.platformVersion}</div>
                    </div>
                </div>
            </div>
         </div>
      )}
    </div>
  );

  return (
    <Layout currentView={currentView} onChangeView={setCurrentView}>
      {currentView === AppView.DASHBOARD && renderDashboard()}
      
      {currentView === AppView.GATHER_REQUIREMENTS && (
        <ChatInterface onComplete={handleRequirementsGathered} />
      )}

      {currentView === AppView.REVIEW_PLAN && activeProject && (
        <TestPlanView 
          project={activeProject} 
          onUpdateProject={handleUpdateProject}
          onProceed={handleStartExecution}
        />
      )}

      {currentView === AppView.EXECUTION && activeProject && (
        <ExecutionRunner 
          project={activeProject} 
          onUpdateProject={handleUpdateProject}
          onComplete={handleExecutionComplete}
        />
      )}

      {currentView === AppView.REPORT && activeProject && (
        <ReportView 
          project={activeProject} 
          onUpdateProject={handleUpdateProject}
          onBackToDashboard={() => setCurrentView(AppView.DASHBOARD)}
          onRetry={handleRetryExecution}
        />
      )}

      {currentView === AppView.HISTORY && (
          <HistoryView onSelectProject={handleHistorySelect} />
      )}
    </Layout>
  );
};

export default App;