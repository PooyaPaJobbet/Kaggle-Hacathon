import React, { useEffect, useState, useRef } from 'react';
import { TestCase, ValidationProject } from '../types';
import { CheckCircle, XCircle, Clock, Terminal, Cloud, MonitorPlay, ChevronRight, Camera } from 'lucide-react';

interface ExecutionRunnerProps {
  project: ValidationProject;
  onUpdateProject: (project: ValidationProject) => void;
  onComplete: () => void;
}

const ExecutionRunner: React.FC<ExecutionRunnerProps> = ({ project, onUpdateProject, onComplete }) => {
  // Local state to force re-renders on update without waiting for parent
  const [testCases, setTestCases] = useState<TestCase[]>(project.testCases);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    setConsoleLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const generateScreenshot = (status: 'PASSED' | 'FAILED', testName: string, failedStep?: number, reason?: string) => {
     // Create a canvas to simulate a screenshot without external dependencies
     const canvas = document.createElement('canvas');
     canvas.width = 640;
     canvas.height = 360;
     const ctx = canvas.getContext('2d');
     if (ctx) {
        // Background
        ctx.fillStyle = status === 'PASSED' ? '#f0fdf4' : '#fef2f2';
        ctx.fillRect(0, 0, 640, 360);
        
        // UI Mockup Header
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 640, 40);
        
        // Text
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(`Test: ${testName.substring(0, 30)}...`, 40, 100);
        
        ctx.fillStyle = status === 'PASSED' ? '#15803d' : '#b91c1c';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(`Status: ${status}`, 40, 140);

        if (failedStep) {
            ctx.fillStyle = '#b91c1c';
            ctx.font = '16px monospace';
            ctx.fillText(`Failed at Step ${failedStep}: ${reason?.substring(0,30)}...`, 40, 170);
        }
        
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px monospace';
        ctx.fillText(`Timestamp: ${new Date().toISOString()}`, 40, 320);

        // Draw simple shapes to look like a UI
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(40, 200, 200, 30);
        ctx.fillRect(40, 240, 200, 30);
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(260, 240, 100, 30);
     }
     return canvas.toDataURL('image/png');
  };

  useEffect(() => {
    if (logsEndRef.current) {
        logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs]);

  useEffect(() => {
    const runTests = async () => {
      let updatedCases = [...testCases];
      addLog("Initializing Cloud Execution Environment...");
      addLog("Connecting to Selenium Grid...");
      await new Promise(r => setTimeout(r, 1000));
      
      const pendingCount = updatedCases.filter(tc => tc.status === 'PENDING').length;
      if (pendingCount === 0) {
          addLog("No pending tests found. Redirecting to report...");
          setTimeout(onComplete, 1000);
          return;
      }

      addLog(`Environment Ready. Starting ${pendingCount} Tests.`);

      for (let i = 0; i < updatedCases.length; i++) {
        const tc = updatedCases[i];
        
        // Skip passed tests
        if (tc.status === 'PASSED') continue;

        setActiveTestId(tc.id);
        
        // Update status to RUNNING
        updatedCases[i] = { ...tc, status: 'RUNNING' };
        setTestCases([...updatedCases]);
        addLog(`Starting Test Case: ${tc.title} (${tc.id})`);

        // Simulate steps execution
        let failedStepNumber: number | undefined = undefined;
        let failureReason: string | undefined = undefined;

        // Determine outcome before running steps to know when to stop
        const isSuccess = Math.random() > 0.3; // 70% success rate
        const failAtStep = !isSuccess ? Math.floor(Math.random() * tc.steps.length) + 1 : -1;

        for (const step of tc.steps) {
            addLog(`  Running Step ${step.stepNumber}: ${step.action}`);
            await new Promise(r => setTimeout(r, 800)); // Simulate work
            
            if (!isSuccess && step.stepNumber === failAtStep) {
                failedStepNumber = step.stepNumber;
                const reasons = [
                    "Element not found within timeout", 
                    "Expected text 'Submit' but found 'Save'", 
                    "API returned 500 Internal Server Error", 
                    "Button is not clickable",
                    "Input validation failed unexpectedly"
                ];
                failureReason = reasons[Math.floor(Math.random() * reasons.length)];
                addLog(`  ❌ Failed Step ${step.stepNumber}: ${failureReason}`);
                break; // Stop execution of this test
            }
        }

        const status: 'PASSED' | 'FAILED' = isSuccess ? 'PASSED' : 'FAILED';
        
        // Generate screenshot for failure or random pass
        let screenshotUrl = undefined;
        if (!isSuccess || Math.random() > 0.8) {
            addLog("  📸 Capturing evidence screenshot...");
            screenshotUrl = generateScreenshot(status, tc.title, failedStepNumber, failureReason);
        }

        updatedCases[i] = { 
            ...tc, 
            status: status,
            logs: [`Result: ${isSuccess ? 'Success' : `Failed at Step ${failedStepNumber}`}`, ...consoleLogs.slice(-5)], // Save last few logs
            screenshotUrl,
            failedStepNumber,
            failureReason
        };
        setTestCases([...updatedCases]);
        
        addLog(`Test Case Finished: ${status}`);
        
        await new Promise(r => setTimeout(r, 500));
      }

      addLog("All tests completed. Generating Report...");
      await new Promise(r => setTimeout(r, 1000));

      // Calculate final project status based on rules:
      // Validated: All passed.
      // Partly Validated: Some failed (<= 50%).
      // Failed: > 50% failed.
      const failedCount = updatedCases.filter(tc => tc.status === 'FAILED').length;
      const totalCount = updatedCases.length;

      let finalStatus: ValidationProject['status'] = 'Validated';
      if (failedCount > totalCount / 2) {
        finalStatus = 'Failed';
      } else if (failedCount > 0) {
        finalStatus = 'Partly Validated';
      } else {
        finalStatus = 'Validated';
      }

      onUpdateProject({ ...project, testCases: updatedCases, status: finalStatus });
      onComplete();
    };

    runTests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASSED': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'FAILED': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'RUNNING': return <LoaderSimple className="w-5 h-5 text-indigo-500 animate-spin" />;
      default: return <Clock className="w-5 h-5 text-slate-300" />;
    }
  };

  return (
    <div className="h-full flex flex-col p-6 gap-6">
      <div className="flex justify-between items-center">
         <div>
            <h2 className="text-xl font-bold text-slate-800">Cloud Execution Simulation</h2>
            <p className="text-sm text-slate-500">Running validation suite on simulated remote infrastructure.</p>
         </div>
         <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
             <Cloud className="w-4 h-4 text-indigo-500"/>
             <span className="text-xs font-semibold text-slate-600">us-east-1a / Ubuntu 22.04 / Chrome 120</span>
         </div>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden">
         {/* Left: Test List */}
         <div className="col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-slate-50 font-medium text-sm text-slate-700">
                Test Suite Queue
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-2">
                {testCases.map(tc => (
                    <div 
                        key={tc.id}
                        className={`p-3 rounded-lg border flex items-center justify-between transition-all ${
                            activeTestId === tc.id 
                            ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-1 ring-indigo-100' 
                            : 'bg-white border-slate-100'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            {getStatusIcon(tc.status)}
                            <div>
                                <div className={`text-sm font-medium ${activeTestId === tc.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                                    {tc.title}
                                </div>
                                <div className="text-xs text-slate-400 font-mono flex gap-2">
                                    <span>{tc.id}</span>
                                    {tc.failedStepNumber && (
                                        <span className="text-red-500">Step {tc.failedStepNumber} Failed</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {tc.screenshotUrl && <Camera className="w-4 h-4 text-slate-300" />}
                            {tc.status === 'RUNNING' && (
                                <span className="text-xs font-semibold text-indigo-600 px-2 py-1 bg-indigo-100 rounded">Running</span>
                            )}
                            {tc.status === 'FAILED' && (
                                <span className="text-xs font-semibold text-red-600 px-2 py-1 bg-red-100 rounded">Failed</span>
                            )}
                            {tc.status === 'PENDING' && (
                                <span className="text-xs font-semibold text-slate-500 px-2 py-1 bg-slate-100 rounded">Pending</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
         </div>

         {/* Right: Console/Visual */}
         <div className="col-span-1 flex flex-col gap-6 h-full">
            {/* Live Visual Placeholder */}
            <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-800 h-48 relative flex flex-col">
                <div className="bg-slate-800 p-2 flex items-center justify-between border-b border-slate-700">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">Simulated Viewport: 1920x1080</div>
                </div>
                <div className="flex-1 flex items-center justify-center bg-slate-950 relative">
                     <MonitorPlay className="w-12 h-12 text-slate-800 absolute"/>
                     {activeTestId && (
                         <div className="text-center z-10">
                             <LoaderSimple className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2"/>
                             <p className="text-xs text-indigo-300 font-mono">Executing interactions...</p>
                         </div>
                     )}
                </div>
            </div>

            {/* Terminal Output */}
            <div className="bg-slate-900 rounded-xl flex-1 shadow-sm border border-slate-800 flex flex-col overflow-hidden">
                 <div className="bg-slate-800 p-2 flex items-center gap-2 border-b border-slate-700">
                    <Terminal className="w-4 h-4 text-slate-400"/>
                    <span className="text-xs font-medium text-slate-300">System Output</span>
                </div>
                <div className="flex-1 p-3 overflow-y-auto font-mono text-[10px] space-y-1">
                    {consoleLogs.map((log, i) => (
                        <div key={i} className={`break-words leading-tight ${log.includes('Failed') || log.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
                            <span className="text-slate-500 mr-2">{'>'}</span>
                            {log}
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};

const LoaderSimple = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);

export default ExecutionRunner;