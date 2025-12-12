import React, { useState } from 'react';
import { ValidationProject, TestCase, TestStep } from '../types';
import { CheckCircle2, FileText, Play, Server, List, Loader2, Edit2, Save, X, Plus, Trash2, Download, Sparkles, Code, Terminal, Check, Settings } from 'lucide-react';
import { generateTestCases, refineTestCase, generateTestSuiteCode } from '../services/geminiService';
import { utils, writeFile } from 'xlsx';

interface TestPlanViewProps {
  project: ValidationProject;
  onUpdateProject: (project: ValidationProject) => void;
  onProceed: () => void;
}

const TestPlanView: React.FC<TestPlanViewProps> = ({ project, onUpdateProject, onProceed }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedReq, setExpandedReq] = useState<string | null>(null);
  
  // Editing State
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TestCase | null>(null);
  const [isEditingVersion, setIsEditingVersion] = useState(false);
  const [tempVersion, setTempVersion] = useState(project.platformVersion);

  // Refine State
  const [refiningTestId, setRefiningTestId] = useState<string | null>(null);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  // Env Config State
  const [showEnvConfig, setShowEnvConfig] = useState(false);
  const [tempEnvConfig, setTempEnvConfig] = useState(project.environmentConfig || '');

  // Code Export State
  const [showCodeExport, setShowCodeExport] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState('Playwright (TypeScript)');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [selectedTestForExport, setSelectedTestForExport] = useState<TestCase | null>(null);

  const handleGenerateTestCases = async () => {
    setIsGenerating(true);
    try {
      const cases = await generateTestCases(project.requirements);
      onUpdateProject({ ...project, testCases: cases });
    } catch (e) {
      console.error(e);
      alert("Failed to generate test cases.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportExcel = () => {
      const rows: any[] = [];
      project.testCases.forEach(tc => {
        tc.steps.forEach(step => {
            rows.push({
                'Test Case ID': tc.id,
                'Requirement ID': tc.requirementId,
                'Test Title': tc.title,
                'Step #': step.stepNumber,
                'Action': step.action,
                'Expected Result': step.expectedResult,
                'Status': tc.status
            });
        });
      });

      const ws = utils.json_to_sheet(rows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Test Plan");
      writeFile(wb, `${project.name.replace(/\s+/g, '_')}_TestPlan.xlsx`);
  };

  const handleExportCode = async () => {
    setIsGeneratingCode(true);
    try {
      // Determine if we are exporting all or just one
      const casesToExport = selectedTestForExport ? [selectedTestForExport] : project.testCases;
      
      const code = await generateTestSuiteCode(casesToExport, selectedFramework, project.environmentConfig);
      const blob = new Blob([code], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      let ext = '.ts';
      if (selectedFramework.includes('Python')) ext = '.py';
      else if (selectedFramework.includes('JavaScript') || selectedFramework.includes('Cypress')) ext = '.js';

      const baseName = project.name.replace(/\s+/g, '_');
      const suffix = selectedTestForExport ? `_${selectedTestForExport.id}` : '_Tests';
      
      a.download = `${baseName}${suffix}${ext}`;
      a.click();
      window.URL.revokeObjectURL(url);
      setShowCodeExport(false);
    } catch (e) {
      console.error(e);
      alert("Failed to generate test code.");
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const startEditing = (tc: TestCase) => {
    setEditingTestId(tc.id);
    setEditForm(JSON.parse(JSON.stringify(tc))); // Deep copy
    // Close refine if open
    setRefiningTestId(null);
  };

  const cancelEditing = () => {
    setEditingTestId(null);
    setEditForm(null);
  };

  const saveTestChanges = () => {
    if (editForm) {
      const updatedCases = project.testCases.map(tc => tc.id === editForm.id ? editForm : tc);
      onUpdateProject({ ...project, testCases: updatedCases });
      setEditingTestId(null);
      setEditForm(null);
    }
  };

  const updateStep = (index: number, field: keyof TestStep, value: string) => {
    if (editForm) {
      const newSteps = [...editForm.steps];
      newSteps[index] = { ...newSteps[index], [field]: value };
      setEditForm({ ...editForm, steps: newSteps });
    }
  };

  const addStep = () => {
    if (editForm) {
      const newStep: TestStep = {
        stepNumber: editForm.steps.length + 1,
        action: "New action",
        expectedResult: "Expected result"
      };
      setEditForm({ ...editForm, steps: [...editForm.steps, newStep] });
    }
  };

  const removeStep = (index: number) => {
    if (editForm) {
        const newSteps = editForm.steps.filter((_, i) => i !== index).map((step, i) => ({...step, stepNumber: i + 1}));
        setEditForm({ ...editForm, steps: newSteps });
    }
  };

  // Refine Logic
  const openRefine = (tc: TestCase) => {
      setRefiningTestId(tc.id);
      setRefinePrompt('');
      // Close edit if open
      setEditingTestId(null);
  };

  const handleRefineSubmit = async (tc: TestCase) => {
      if (!refinePrompt.trim()) return;
      setIsRefining(true);
      try {
          const result = await refineTestCase(tc, refinePrompt);
          const updatedCases = project.testCases.map(t => 
              t.id === tc.id ? { ...t, title: result.title, steps: result.steps } : t
          );
          onUpdateProject({ ...project, testCases: updatedCases });
          setRefiningTestId(null);
          setRefinePrompt('');
      } catch (e) {
          console.error(e);
          alert("Failed to refine test case.");
      } finally {
          setIsRefining(false);
      }
  };

  const saveVersion = () => {
      onUpdateProject({ ...project, platformVersion: tempVersion });
      setIsEditingVersion(false);
  };

  const saveEnvConfig = () => {
      onUpdateProject({ ...project, environmentConfig: tempEnvConfig });
      setShowEnvConfig(false);
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'High': return 'text-red-600 bg-red-50 border-red-200';
      case 'Medium': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'Low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 pb-24 relative">
       {/* Code Export Modal */}
       {showCodeExport && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-indigo-600"/>
                <h3 className="font-bold text-slate-800">Export Test Scripts</h3>
              </div>
              <button onClick={() => setShowCodeExport(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5"/>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500">
                {selectedTestForExport 
                  ? `Select a framework to export code for "${selectedTestForExport.title}".` 
                  : "Select a framework. AI will generate a runnable test script for the entire suite using your environment settings."}
              </p>
              <div className="space-y-2">
                {['Playwright (TypeScript)', 'Cypress (JavaScript)', 'Selenium (Python)'].map(fw => (
                  <div 
                    key={fw}
                    onClick={() => setSelectedFramework(fw)}
                    className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${
                      selectedFramework === fw 
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                      : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm font-medium">{fw}</span>
                    {selectedFramework === fw && <Check className="w-4 h-4 text-indigo-600"/>}
                  </div>
                ))}
              </div>
              <button 
                onClick={handleExportCode}
                disabled={isGeneratingCode}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mt-4"
              >
                {isGeneratingCode ? <Loader2 className="w-4 h-4 animate-spin"/> : <Code className="w-4 h-4"/>}
                {isGeneratingCode ? 'Generating Code...' : 'Download Script'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Environment Config Modal */}
      {showEnvConfig && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <div className="flex items-center gap-2">
                 <Settings className="w-5 h-5 text-indigo-600"/>
                 <h3 className="font-bold text-slate-800">Test Environment Configuration</h3>
               </div>
               <button onClick={() => setShowEnvConfig(false)} className="text-slate-400 hover:text-slate-600">
                 <X className="w-5 h-5"/>
               </button>
             </div>
             <div className="p-6 flex-1 overflow-y-auto">
               <p className="text-sm text-slate-500 mb-4">
                 Provide your environment details (URLs, users, passwords, API keys) in free text below. 
                 The AI will automatically identify these and use them when generating the test automation code.
               </p>
               <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                  <p className="text-xs font-mono text-slate-500 mb-2">Example:</p>
                  <pre className="text-xs text-slate-600 overflow-x-auto whitespace-pre-wrap">
                    BASE_URL = "https://staging.myapp.com"{'\n'}
                    Admin User: admin@test.com / Pass: secret123{'\n'}
                    Standard User: user@test.com / Pass: user123
                  </pre>
               </div>
               <textarea
                 value={tempEnvConfig}
                 onChange={(e) => setTempEnvConfig(e.target.value)}
                 className="w-full h-64 p-4 border border-slate-200 rounded-lg font-mono text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                 placeholder="Enter your configuration here..."
               />
             </div>
             <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-2">
                <button onClick={() => setShowEnvConfig(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Cancel</button>
                <button onClick={saveEnvConfig} className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium flex items-center gap-2">
                   <Save className="w-4 h-4"/> Save Configuration
                </button>
             </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Validation Plan: {project.name}</h1>
          <div className="flex gap-4 text-sm text-slate-500 items-center">
             <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                <Server className="w-4 h-4 text-slate-500"/> 
                <span className="text-slate-500 font-medium">Software Version:</span>
                {isEditingVersion ? (
                    <div className="flex items-center gap-1">
                        <input 
                            value={tempVersion} 
                            onChange={(e) => setTempVersion(e.target.value)}
                            className="w-20 px-1 py-0.5 text-xs border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button onClick={saveVersion} className="text-emerald-600 hover:text-emerald-700"><CheckCircle2 className="w-4 h-4"/></button>
                        <button onClick={() => setIsEditingVersion(false)} className="text-red-500 hover:text-red-600"><X className="w-4 h-4"/></button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingVersion(true)}>
                        <span className="font-mono font-bold text-indigo-600">{project.platformVersion}</span>
                        <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                )}
             </div>
             
             {/* Config Button */}
             <button 
                onClick={() => {
                  setTempEnvConfig(project.environmentConfig || '');
                  setShowEnvConfig(true);
                }}
                className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-colors ${project.environmentConfig ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'}`}
             >
                <Settings className="w-4 h-4"/>
                <span className="font-medium">{project.environmentConfig ? 'Configured' : 'Configure Env'}</span>
             </button>

             <span className="flex items-center gap-1"><FileText className="w-4 h-4"/> {project.requirements.length} Requirements</span>
          </div>
        </div>
        <div className="flex gap-2">
            {project.testCases.length > 0 && (
                <>
                <button 
                    onClick={() => {
                        setSelectedTestForExport(null);
                        setShowCodeExport(true);
                    }}
                    className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 text-sm shadow-sm"
                >
                    <Code className="w-4 h-4" />
                    Export All Code
                </button>
                <button 
                    onClick={handleExportExcel}
                    className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 text-sm shadow-sm"
                >
                    <Download className="w-4 h-4" />
                    Export Excel
                </button>
                <button 
                    onClick={onProceed}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2"
                >
                    <Play className="w-4 h-4" />
                    Start Execution
                </button>
                </>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Requirements List */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <List className="w-5 h-5"/> Requirements
          </h3>
          <div className="space-y-3">
            {project.requirements.map(req => (
              <div 
                key={req.id} 
                onClick={() => setExpandedReq(expandedReq === req.id ? null : req.id)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${expandedReq === req.id ? 'border-indigo-500 ring-1 ring-indigo-500 bg-white' : 'border-slate-200 bg-white hover:border-indigo-300'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${getPriorityColor(req.priority)}`}>
                    {req.priority}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{req.type.split(' ')[0]}</span>
                </div>
                <p className="text-sm text-slate-800 leading-snug">{req.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Test Cases View */}
        <div className="lg:col-span-2 space-y-4">
           <div className="flex justify-between items-center">
             <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5"/> Test Cases
             </h3>
             {project.testCases.length === 0 && (
               <button 
                onClick={handleGenerateTestCases}
                disabled={isGenerating}
                className="text-sm bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
               >
                 {isGenerating ? <Loader2 className="w-4 h-4 animate-spin"/> : <Bot className="w-4 h-4 text-emerald-600"/>}
                 Auto-Generate Cases
               </button>
             )}
           </div>

           {project.testCases.length === 0 ? (
             <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center bg-slate-50/50">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                   <FileText className="w-8 h-8 text-slate-300"/>
                </div>
                <p className="text-slate-500 font-medium">No test cases generated yet.</p>
                <p className="text-sm text-slate-400 mt-1">Click the button above to have AI generate them from requirements.</p>
             </div>
           ) : (
             <div className="space-y-4">
               {project.testCases
                 .filter(tc => !expandedReq || tc.requirementId === expandedReq)
                 .map((tc) => (
                 <div key={tc.id} className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-all ${editingTestId === tc.id ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-slate-200'}`}>
                    {editingTestId === tc.id && editForm ? (
                        // EDIT MODE
                        <div className="p-4 bg-slate-50">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1 mr-4">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Test Case Title</label>
                                    <input 
                                        type="text" 
                                        value={editForm.title}
                                        onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                                        className="w-full mt-1 p-2 border border-slate-300 rounded text-sm font-medium focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-2 mb-4">
                                <label className="text-xs font-bold text-slate-500 uppercase">Test Steps</label>
                                {editForm.steps.map((step, idx) => (
                                    <div key={idx} className="flex gap-2 items-start bg-white p-2 border border-slate-200 rounded">
                                        <span className="text-xs font-mono text-slate-400 mt-2">{idx + 1}</span>
                                        <div className="flex-1 grid grid-cols-2 gap-2">
                                            <textarea 
                                                value={step.action}
                                                onChange={(e) => updateStep(idx, 'action', e.target.value)}
                                                placeholder="Action"
                                                rows={2}
                                                className="w-full p-2 border border-slate-200 rounded text-xs focus:border-indigo-500 focus:outline-none resize-none"
                                            />
                                            <textarea 
                                                value={step.expectedResult}
                                                onChange={(e) => updateStep(idx, 'expectedResult', e.target.value)}
                                                placeholder="Expected Result"
                                                rows={2}
                                                className="w-full p-2 border border-slate-200 rounded text-xs focus:border-indigo-500 focus:outline-none resize-none"
                                            />
                                        </div>
                                        <button onClick={() => removeStep(idx)} className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button 
                                    onClick={addStep}
                                    className="w-full py-2 border border-dashed border-slate-300 rounded text-slate-500 text-xs font-medium hover:bg-slate-50 flex items-center justify-center gap-1"
                                >
                                    <Plus className="w-3 h-3"/> Add Step
                                </button>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button onClick={cancelEditing} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded">Cancel</button>
                                <button onClick={saveTestChanges} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1">
                                    <Save className="w-4 h-4"/> Save Changes
                                </button>
                            </div>
                        </div>
                    ) : (
                        // VIEW MODE
                        <>
                            <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-sm text-slate-800">{tc.title}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400 font-mono mr-2">{tc.id}</span>
                                        
                                        <button 
                                            onClick={() => {
                                                setSelectedTestForExport(tc);
                                                setShowCodeExport(true);
                                            }}
                                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                            title="Download Code"
                                        >
                                            <Download className="w-4 h-4"/>
                                        </button>
                                        
                                        <button 
                                            onClick={() => openRefine(tc)}
                                            className="p-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors flex items-center gap-1 text-xs font-medium"
                                            title="Refine with AI"
                                        >
                                            <Sparkles className="w-3.5 h-3.5"/>
                                            Refine
                                        </button>
                                        <button 
                                            onClick={() => startEditing(tc)}
                                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
                                            title="Edit Manually"
                                        >
                                            <Edit2 className="w-4 h-4"/>
                                        </button>
                                    </div>
                                </div>
                                {refiningTestId === tc.id && (
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 animate-fade-in mt-1">
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={refinePrompt}
                                                    onChange={(e) => setRefinePrompt(e.target.value)}
                                                    placeholder="E.g. Add a step to verify error message..."
                                                    className="w-full border border-indigo-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    autoFocus
                                                />
                                            </div>
                                            <button 
                                                onClick={() => handleRefineSubmit(tc)}
                                                disabled={isRefining || !refinePrompt.trim()}
                                                className="bg-indigo-600 text-white px-3 py-2 rounded font-medium text-xs hover:bg-indigo-700 disabled:opacity-50"
                                            >
                                                {isRefining ? <Loader2 className="w-4 h-4 animate-spin"/> : "Generate"}
                                            </button>
                                            <button 
                                                onClick={() => setRefiningTestId(null)}
                                                className="text-slate-400 hover:text-slate-600 p-2"
                                            >
                                                <X className="w-4 h-4"/>
                                            </button>
                                        </div>
                                        <div className="mt-1 text-[10px] text-indigo-400 flex items-center gap-1">
                                            <Sparkles className="w-3 h-3"/> AI will rewrite the test case based on your instruction.
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="p-4">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-100">
                                    <tr>
                                        <th className="py-2 w-12">#</th>
                                        <th className="py-2">Action</th>
                                        <th className="py-2">Expected Result</th>
                                    </tr>
                                    </thead>
                                    <tbody className="text-slate-600">
                                    {tc.steps.map((step) => (
                                        <tr key={step.stepNumber} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                                        <td className="py-3 font-mono text-xs text-slate-400">{step.stepNumber}</td>
                                        <td className="py-3 pr-4">{step.action}</td>
                                        <td className="py-3 text-slate-500 italic">{step.expectedResult}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                 </div>
               ))}
               {expandedReq && project.testCases.filter(tc => tc.requirementId === expandedReq).length === 0 && (
                   <p className="text-center text-slate-400 py-8 italic">No test cases specific to this requirement found.</p>
               )}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

// Simple Icon component needed for above
const Bot = ({className}: {className?: string}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
);

export default TestPlanView;