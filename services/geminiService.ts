import { GoogleGenAI, Type, Schema, GenerateContentResponse } from "@google/genai";
import { Requirement, RequirementType, TestCase, TestStep } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Retry Helper
async function retry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    console.warn(`Retrying Gemini call... attempts left: ${retries}`);
    await new Promise(r => setTimeout(r, delay));
    return retry(fn, retries - 1, delay * 1.5);
  }
}

// System instruction for the chat agent
const CHAT_SYSTEM_INSTRUCTION = `
You are a Senior QA Validation Agent. Your goal is to help the user define a software feature so you can validate it.
Ask clarifying questions to gather:
1. User Requirements (What the user needs)
2. Functional Requirements (How the system behaves)
3. Technical Requirements (Performance, Security, APIs)

Be professional, concise, and guiding. Do not generate code, just gather info.
`;

export const createChatSession = () => {
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: CHAT_SYSTEM_INSTRUCTION,
    },
  });
};

// Schema for extracting structured requirements
const requirementsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    requirements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: [RequirementType.USER, RequirementType.FUNCTIONAL, RequirementType.TECHNICAL] },
          description: { type: Type.STRING },
          priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
        },
        required: ['type', 'description', 'priority'],
      },
    },
    suggestedProjectName: { type: Type.STRING }
  },
  required: ['requirements', 'suggestedProjectName'],
};

export const extractRequirements = async (chatHistory: string): Promise<{ requirements: Requirement[], name: string }> => {
  const prompt = `
  Based on the following conversation history, extract a comprehensive list of requirements.
  Also suggest a short, professional project name.
  
  Conversation History:
  ${chatHistory}
  `;

  const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: requirementsSchema,
    },
  }));

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");

  const data = JSON.parse(text);
  
  // Add IDs locally
  const requirements = data.requirements.map((req: any, index: number) => ({
    ...req,
    id: `REQ-${Date.now()}-${index}`
  }));

  return { requirements, name: data.suggestedProjectName };
};

// Schema for generating Test Cases
const testCaseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    testCases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          requirementId: { type: Type.STRING, description: "The ID of the requirement this test covers" },
          title: { type: Type.STRING },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                stepNumber: { type: Type.INTEGER },
                action: { type: Type.STRING },
                expectedResult: { type: Type.STRING },
              },
              required: ['stepNumber', 'action', 'expectedResult']
            }
          }
        },
        required: ['requirementId', 'title', 'steps']
      }
    }
  },
  required: ['testCases']
};

export const generateTestCases = async (requirements: Requirement[]): Promise<TestCase[]> => {
  const prompt = `
  Generate detailed test cases for the following requirements.
  Ensure every requirement has at least one test case.
  
  Requirements:
  ${JSON.stringify(requirements)}
  `;

  const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: testCaseSchema,
    },
  }));

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");

  const data = JSON.parse(text);

  return data.testCases.map((tc: any, index: number) => ({
    ...tc,
    id: `TC-${Date.now()}-${index}`,
    status: 'PENDING',
    logs: []
  }));
};

// AI Fix Logic
const fixTestSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        steps: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    stepNumber: { type: Type.INTEGER },
                    action: { type: Type.STRING },
                    expectedResult: { type: Type.STRING },
                },
                required: ['stepNumber', 'action', 'expectedResult']
            }
        },
        explanation: { type: Type.STRING }
    },
    required: ['steps', 'explanation']
};

export const analyzeAndFixTestCase = async (testCase: TestCase): Promise<{ steps: TestStep[], explanation: string }> => {
  const failedStep = testCase.steps.find(s => s.stepNumber === testCase.failedStepNumber);
  
  const prompt = `
  The following test case failed during execution.
  
  Test Title: ${testCase.title}
  Failed Step #${testCase.failedStepNumber}: ${failedStep?.action || 'Unknown'}
  Expected Result: ${failedStep?.expectedResult || 'Unknown'}
  Failure Reason: ${testCase.failureReason || 'Unknown error'}
  
  Full Steps:
  ${JSON.stringify(testCase.steps)}
  
  Please analyze the failure and generate a corrected list of steps. 
  - You may add 'Wait' steps.
  - You may refine the action description.
  - You may split complex steps.
  
  Return the new steps and a short explanation of the fix.
  `;

  const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: fixTestSchema,
    },
  }));

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");

  return JSON.parse(text);
};

// Schema for Single Test Case Refinement
const singleTestCaseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          stepNumber: { type: Type.INTEGER },
          action: { type: Type.STRING },
          expectedResult: { type: Type.STRING },
        },
        required: ['stepNumber', 'action', 'expectedResult']
      }
    }
  },
  required: ['title', 'steps']
};

export const refineTestCase = async (testCase: TestCase, instruction: string): Promise<{ title: string, steps: TestStep[] }> => {
  const prompt = `
  Refine the following test case based on the user's instruction.
  
  Current Test Case:
  Title: ${testCase.title}
  Steps: ${JSON.stringify(testCase.steps)}
  
  User Instruction: "${instruction}"
  
  Return the updated title and steps in the specified JSON structure. Ensure step numbers are sequential starting from 1.
  `;

  const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: singleTestCaseSchema,
    },
  }));

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");

  return JSON.parse(text);
};

// Generate Executable Code Logic
export const generateTestSuiteCode = async (testCases: TestCase[], framework: string = 'Playwright', envConfig?: string): Promise<string> => {
  const prompt = `
  You are a Senior Test Automation Engineer.
  Generate a single, complete, runnable test script file for the following test cases using ${framework}.

  ${envConfig ? `
  --- ENVIRONMENT CONFIGURATION ---
  The user has provided the following free-text configuration (URLs, credentials, etc).
  1. ANALYZE this text to extract specific values (Base URLs, Usernames, Passwords, API Keys).
  2. DEFINE these extracted values as constants at the TOP of the script (e.g. const BASE_URL = "...";).
  3. INTELLIGENTLY USE these constants in the test code. 
     - If a step says "Navigate to application", use 'page.goto(BASE_URL)'.
     - If a step says "Login as Admin", use the extracted admin credentials.
  
  Configuration Input:
  """
  ${envConfig}
  """
  ---------------------------------
  ` : ''}

  Input Data:
  ${JSON.stringify(testCases.map(tc => ({
      id: tc.id,
      title: tc.title,
      steps: tc.steps
  })))}

  Requirements:
  1. Header: Include a comment block at the very top with the exact commands to install dependencies and run this file (e.g., 'npm install ...', 'npx playwright test ...').
  2. Traceability: For EACH test case, include a comment with the Test Case ID and Title before the test definition.
  3. Implementation: Write code that attempts to match the natural language step descriptions. Use best-guess semantic selectors (e.g., 'text=Save', 'button[name="submit"]').
  4. Assertions: Convert "Expected Result" into assertions.
  5. Structure: Use standard syntax for ${framework} (e.g., 'describe', 'test'/'it').
  6. Output: Return ONLY the raw code string. Do NOT use Markdown code blocks (like \`\`\`). Do not include any text outside the code.
  `;

  const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  }));

  const text = response.text || '';
  // Clean up if markdown is returned despite instructions
  return text.replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '');
};