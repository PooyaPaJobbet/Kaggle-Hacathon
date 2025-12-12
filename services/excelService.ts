import { read, utils } from 'xlsx';
import { Requirement, RequirementType } from '../types';

export const parseExcelRequirements = async (file: File): Promise<{ requirements: Requirement[], name: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        // Use named export 'read'
        const workbook = read(data, { type: 'array' });
        
        // Assume first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Use named export 'utils'
        const jsonData: any[] = utils.sheet_to_json(worksheet);
        
        const requirements: Requirement[] = jsonData.map((row, index) => {
          // Attempt to map columns flexibly (case insensitive search could be added)
          const description = row['Description'] || row['Requirement'] || row['desc'] || Object.values(row)[0];
          const typeRaw = row['Type'] || row['Category'] || 'Functional';
          const priorityRaw = row['Priority'] || 'Medium';

          let type = RequirementType.FUNCTIONAL;
          if (String(typeRaw).toLowerCase().includes('user')) type = RequirementType.USER;
          if (String(typeRaw).toLowerCase().includes('tech')) type = RequirementType.TECHNICAL;

          let priority: 'High' | 'Medium' | 'Low' = 'Medium';
          if (String(priorityRaw).toLowerCase().includes('high')) priority = 'High';
          if (String(priorityRaw).toLowerCase().includes('low')) priority = 'Low';

          return {
            id: `REQ-IMPORT-${Date.now()}-${index}`,
            description: String(description),
            type,
            priority
          };
        }).filter(req => req.description && req.description.trim() !== '');

        const fileName = file.name.split('.')[0];
        // Clean up filename for project name
        const projectName = fileName.charAt(0).toUpperCase() + fileName.slice(1).replace(/[-_]/g, ' ');

        resolve({ requirements, name: projectName });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};