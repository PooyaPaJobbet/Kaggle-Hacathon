
import React, { useState } from 'react';
import { ValidationProject, TestCase, TestStep } from '../types';
import { CheckCircle2, AlertTriangle, Download, Share2, ShieldCheck, Camera, Loader2, RefreshCcw, Wrench, X, Save, Sparkles, Trash2, Plus, Code, Terminal, Check, FileCode, MessageSquare, Bot, User } from 'lucide-react';
import { analyzeAndFixTestCase, generateTestSuiteCode } from '../services/geminiService';

interface ReportViewProps {
  project: ValidationProject;
  onUpdateProject: (project: ValidationProject) => void;
  onBackToDashboard: () => void;
  onRetry: () => void;
}

const ReportView: React.FC<ReportViewProps> = ({ project, onUpdateProject, onBackToDashboard, onRetry }) => {
  const [isExporting, setIsExporting] = useState(false);
  
  // Fix Modal State
  const [selectedTest, setSelectedTest] = useState<TestCase | null>(null);
  const [isFixing, setIsFixing] = useState(false);
  const [fixExplanation, setFixExplanation] = useState<string>('');

  // Code Export State
  const [showCodeExport, setShowCodeExport] = useState(false);
  const [selectedTestForExport, setSelectedTestForExport] = useState<TestCase | null>(null);
  const [selectedFramework, setSelectedFramework] = useState('Playwright (TypeScript)');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  // Chat History State
  const [showChatHistory, setShowChatHistory] = useState(false);

  const passed = project.testCases.filter(tc => tc.status === 'PASSED').length;
  const failed = project.testCases.filter(tc => tc.status === 'FAILED').length;
  const total = project.testCases.length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  const handleExportPdf = () => {
    const element = document.getElementById('report-view-container');
    if (!element) return;

    setIsExporting(true);

    const opt = {
      margin: [10, 10, 10, 10], // top, left, bottom, right
      filename: `ValidAI_Report_${project.name.replace(/\s+/g, '_')}_v${project.platformVersion}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // Use globally loaded html2pdf
    // @ts-ignore
    if (window.html2pdf) {
      // @ts-ignore
      window.html2pdf().set(opt).from(element).save().then(() => {
        setIsExporting(false);
      }).catch((err: any) => {
        console.error("PDF generation failed:", err);
        alert("PDF Generation failed. Falling back to print.");
        window.print();
        setIsExporting(false);
      });
    } else {
      console.warn("html2pdf not found, using window.print()");
      window.print();
      setIsExporting(false);
    }
  };

  const handleExportCode = async () => {
    setIsGeneratingCode(true);
    try {
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

  const openFixModal = (tc: TestCase) => {
      setSelectedTest(JSON.parse(JSON.stringify(tc))); // Deep copy
      setFixExplanation('');
  };

  const handleAiFix = async () => {
      if (!selectedTest) return;
      setIsFixing(true);
      try {
          const result = await analyzeAndFixTestCase(selectedTest);
          setSelectedTest({
              ...selectedTest,
              steps: result.steps
          });
          setFixExplanation(result.explanation);
      } catch (e) {
          console.error(e);
          alert("AI Fix failed. Please try again.");
      } finally {
          setIsFixing(false);
      }
  };

  const handleStepChange = (index: number, field: keyof TestStep, value: string) => {
      if (!selectedTest) return;
      const newSteps = [...selectedTest.steps];
      newSteps[index] = { ...newSteps[index], [field]: value };
      setSelectedTest({ ...selectedTest, steps: newSteps });
  };

  const addStep = () => {
      if (!selectedTest) return;
      const newStep: TestStep = {
          stepNumber: selectedTest.steps.length + 1,
          action: "New step action",
          expectedResult: "Expected result"
      };
      setSelectedTest({ ...selectedTest, steps: [...selectedTest.steps, newStep] });
  };

  const removeStep = (index: number) => {
      if (!selectedTest) return;
      const newSteps = selectedTest.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepNumber: i + 1 }));
      setSelectedTest({ ...selectedTest, steps: newSteps });
  };

  const handleSaveAndRetry = () => {
      if (!selectedTest) return;
      
      // Update project with fixed test case and set status to PENDING
      const updatedTestCases = project.testCases.map(tc => 
          tc.id === selectedTest.id 
            ? { ...selectedTest, status: 'PENDING' as const, failedStepNumber: undefined, failureReason: undefined, screenshotUrl: undefined, logs: [] } 
            : tc
      );

      onUpdateProject({ ...project, testCases: updatedTestCases, status: 'In Progress' });
      setSelectedTest(null);
      onRetry();
  };

  return (
    <div className="relative min-h-screen">
        {/* Chat History Modal */}
        {showChatHistory && (
          <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in no-print" data-html2canvas-ignore="true">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-indigo-600"/>
                    <div>
                      <h3 className="font-bold text-slate-800">Agent Interaction History</h3>
                      <p className="text-xs text-slate-500">Transcript of requirements gathering session</p>
                    </div>
                  </div>
                  <button onClick={() => setShowChatHistory(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5"/>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
                  {project.chatHistory && project.chatHistory.length > 0 ? (
                    project.chatHistory.map((msg, idx) => (
                      <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-indigo-100' : 'bg-emerald-100'}`}>
                            {msg.role === 'user' ? <User className="w-5 h-5 text-indigo-600"/> : <Bot className="w-5 h-5 text-emerald-600"/>}
                        </div>
                        <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                            msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                        }`}>
                            {msg.text}
                            <div className={`text-[10px] mt-1 opacity-60 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-slate-400 py-12">
                      <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20"/>
                      <p>No chat history available for this project.</p>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-slate-100 bg-white text-right">
                  <button onClick={() => setShowChatHistory(false)} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium">Close Transcript</button>
                </div>
             </div>
          </div>
        )}

        {/* Code Export Modal */}
        {showCodeExport && (
          <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in no-print" data-html2canvas-ignore="true">
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
                    : "Select a framework. AI will generate a runnable test script based on the current results."}
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

        {/* Fix Modal */}
        {selectedTest && (
            <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                        <div>
                            <h3 className="font-bold text-slate-800">Fix Failed Test Case</h3>
                            <p className="text-xs text-slate-500">{selectedTest.title}</p>
                        </div>
                        <button onClick={() => setSelectedTest(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
                    </div>

                    <div className="p-4 bg-red-50 border-b border-red-100 flex gap-3">
                         <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                         <div>
                             <p className="text-sm font-semibold text-red-800">
                                 Failure at Step {selectedTest.failedStepNumber || 'Unknown'}
                             </p>
                             <p className="text-xs text-red-600 mt-1">{selectedTest.failureReason}</p>
                         </div>
                    </div>
                    
                    {fixExplanation && (
                        <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex gap-3 animate-fade-in">
                            <Sparkles className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-emerald-800">AI Fix Applied</p>
                                <p className="text-xs text-emerald-600 mt-1">{fixExplanation}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                        {selectedTest.steps.map((step, idx) => (
                            <div key={idx} className={`p-3 rounded-lg border ${selectedTest.failedStepNumber === step.stepNumber ? 'bg-red-50 border-red-200 ring-1 ring-red-200' : 'bg-white border-slate-200'}`}>
                                <div className="flex justify-between mb-1">
                                    <span className={`text-xs font-mono font-bold ${selectedTest.failedStepNumber === step.stepNumber ? 'text-red-600' : 'text-slate-400'}`}>Step {step.stepNumber}</span>
                                    <button onClick={() => removeStep(idx)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3"/></button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <textarea 
                                        value={step.action} 
                                        onChange={(e) => handleStepChange(idx, 'action', e.target.value)}
                                        className="text-xs p-2 border border-slate-200 rounded w-full resize-none focus:border-indigo-500 focus:outline-none"
                                        rows={2}
                                        placeholder="Action"
                                    />
                                    <textarea 
                                        value={step.expectedResult}
                                        onChange={(e) => handleStepChange(idx, 'expectedResult', e.target.value)} 
                                        className="text-xs p-2 border border-slate-200 rounded w-full resize-none focus:border-indigo-500 focus:outline-none"
                                        rows={2}
                                        placeholder="Expected Result"
                                    />
                                </div>
                            </div>
                        ))}
                        <button onClick={addStep} className="w-full py-2 border border-dashed border-slate-300 rounded text-xs text-slate-500 hover:bg-white hover:text-indigo-600 flex items-center justify-center gap-1">
                            <Plus className="w-3 h-3" /> Add Step
                        </button>
                    </div>

                    <div className="p-4 border-t border-slate-100 flex justify-between bg-white rounded-b-xl">
                        <button 
                            onClick={handleAiFix}
                            disabled={isFixing}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                            {isFixing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                            Auto-Fix with AI
                        </button>
                        <div className="flex gap-2">
                            <button onClick={() => setSelectedTest(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Cancel</button>
                            <button onClick={handleSaveAndRetry} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium shadow-sm">
                                <RefreshCcw className="w-4 h-4"/> Save & Retry
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div id="report-view-container" className="p-8 max-w-5xl mx-auto space-y-8 animate-fade-in bg-white print:p-0 print:max-w-none min-h-screen">
            {/* Header Banner */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex justify-between items-center print:border-0 print:shadow-none">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold text-slate-900">Validation Report</h1>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                            passRate === 100 
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}>
                            {passRate === 100 ? 'Passed' : 'Completed with Issues'}
                        </span>
                    </div>
                    <p className="text-slate-500">Project: <span className="font-semibold text-slate-700">{project.name}</span> • Software Version: {project.platformVersion}</p>
                </div>
                
                {/* Controls - Hidden in PDF */}
                <div className="flex gap-3" data-html2canvas-ignore="true">
                    {/* Chat History Button */}
                    <button
                        onClick={() => setShowChatHistory(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors text-sm shadow-sm"
                        title="View Conversation with Agent"
                    >
                        <MessageSquare className="w-4 h-4"/> <span className="hidden sm:inline">View Chat</span>
                    </button>

                    <button 
                        onClick={() => {
                            setSelectedTestForExport(null);
                            setShowCodeExport(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors text-sm shadow-sm"
                    >
                        <Code className="w-4 h-4"/> Export Full Suite
                    </button>
                    <button 
                        onClick={handleExportPdf}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors text-sm shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}
                        {isExporting ? "Generating PDF..." : "Export PDF"}
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print:grid-cols-4 print:gap-4">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:border print:shadow-none">
                    <div className="text-slate-500 text-sm font-medium mb-1">Total Pass Rate</div>
                    <div className="text-4xl font-bold text-slate-900 flex items-baseline gap-2">
                        {passRate}% 
                        {passRate >= 90 ? <CheckCircle2 className="w-6 h-6 text-emerald-500"/> : <AlertTriangle className="w-6 h-6 text-amber-500"/>}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:border print:shadow-none">
                    <div className="text-slate-500 text-sm font-medium mb-1">Test Cases Passed</div>
                    <div className="text-4xl font-bold text-emerald-600">{passed}</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:border print:shadow-none">
                    <div className="text-slate-500 text-sm font-medium mb-1">Test Cases Failed</div>
                    <div className="text-4xl font-bold text-red-600">{failed}</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:border print:shadow-none">
                    <div className="text-slate-500 text-sm font-medium mb-1">Coverage</div>
                    <div className="text-4xl font-bold text-indigo-600">100%</div>
                </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:border print:shadow-none">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800">Detailed Execution Log</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <ShieldCheck className="w-4 h-4"/>
                        Verified by ValidAI Agent
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 font-medium">Test Case ID</th>
                                <th className="px-6 py-4 font-medium">Title</th>
                                <th className="px-6 py-4 font-medium">Result Details</th>
                                <th className="px-6 py-4 font-medium">Test Script</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium text-right no-print">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                            {project.testCases.map(tc => (
                                <tr key={tc.id} className="print-break-inside-avoid hover:bg-slate-50/50">
                                    <td className="px-6 py-4 font-mono text-slate-400 text-xs">{tc.id}</td>
                                    <td className="px-6 py-4 text-slate-700 font-medium">
                                        {tc.title}
                                        {tc.failedStepNumber && (
                                            <div className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3"/> Failed at Step {tc.failedStepNumber}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 max-w-xs">
                                        {tc.failureReason ? (
                                            <span className="text-red-600 text-xs bg-red-50 px-2 py-1 rounded border border-red-100 block">
                                                {tc.failureReason}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">All {tc.steps.length} steps executed successfully.</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => {
                                                setSelectedTestForExport(tc);
                                                setShowCodeExport(true);
                                            }}
                                            className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 text-xs font-medium bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors"
                                            data-html2canvas-ignore="true"
                                        >
                                            <FileCode className="w-3.5 h-3.5"/> View Code
                                        </button>
                                        {/* Fallback for PDF/Print where button hides */}
                                        <div className="hidden print:block text-xs text-slate-400 font-mono">
                                            [Code Available in App]
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                            tc.status === 'PASSED' 
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                            : 'bg-red-50 text-red-700 border-red-200'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${tc.status === 'PASSED' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                            {tc.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right no-print">
                                        {tc.status === 'FAILED' && (
                                            <button 
                                                onClick={() => openFixModal(tc)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                                            >
                                                <Wrench className="w-3 h-3"/> Fix & Retry
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex justify-center pt-8 no-print" data-html2canvas-ignore="true">
                <button 
                    onClick={onBackToDashboard}
                    className="text-slate-500 hover:text-slate-800 font-medium transition-colors"
                >
                    ← Back to Dashboard
                </button>
            </div>
        </div>
    </div>
  );
};

export default ReportView;
