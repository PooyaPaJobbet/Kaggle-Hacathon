export enum AppView {
  DASHBOARD = 'DASHBOARD',
  GATHER_REQUIREMENTS = 'GATHER_REQUIREMENTS',
  REVIEW_PLAN = 'REVIEW_PLAN',
  EXECUTION = 'EXECUTION',
  REPORT = 'REPORT',
  HISTORY = 'HISTORY'
}

export enum RequirementType {
  USER = 'User Requirement',
  FUNCTIONAL = 'Functional Requirement',
  TECHNICAL = 'Technical Requirement'
}

export interface Requirement {
  id: string;
  type: RequirementType;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface TestStep {
  stepNumber: number;
  action: string;
  expectedResult: string;
}

export interface TestCase {
  id: string;
  requirementId: string; // Links back to a requirement
  title: string;
  steps: TestStep[];
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED';
  logs: string[];
  screenshotUrl?: string; // New field for evidence
  failedStepNumber?: number; // Identify which step failed
  failureReason?: string; // Reason for failure
}

export interface ValidationProject {
  id: string;
  name: string;
  platformVersion: string;
  status: 'Draft' | 'In Progress' | 'Validated' | 'Partly Validated' | 'Failed';
  createdAt: string;
  requirements: Requirement[];
  testCases: TestCase[];
  chatHistory: ChatMessage[];
  environmentConfig?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}