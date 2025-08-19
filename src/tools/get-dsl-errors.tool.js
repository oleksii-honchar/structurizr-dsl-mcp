const { z } = require('zod');
const fs = require('fs');

const { CONFIG } = require('../config');

export const registerGetDslErrorsTool = (server) => {
  server.registerTool(
    'getDslErrors',
    {
      title: 'Get DSL Errors',
      description: 'Retrieves recent Structurizr DSL errors from the log file',
      inputSchema: {
        count: z.number().int().min(1).max(100).default(10).describe('Number of recent DSL errors to retrieve')
      }
    },
    async ({ count = 10 }) => {
      try {
        // Read DSL errors
        const errors = JSON.parse(fs.readFileSync(CONFIG.dslLogFile, 'utf-8'));
        const recentErrors = errors.slice(-count);
        
        if (recentErrors.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No DSL errors found in the log"
            }]
          };
        }
        
        const errorSummary = recentErrors.map((error, index) => 
          `${index + 1}. ${error.message} (Line ${error.line} in ${error.file})`
        ).join('\n');
        
        return {
          content: [{
            type: "text",
            text: `Found ${recentErrors.length} recent DSL errors:\n\n${errorSummary}\n\nDetailed errors: ${JSON.stringify(recentErrors, null, 2)}`
          }]
        };
      } catch (error) {
        console.error('Error retrieving DSL errors:', error);
        return {
          content: [{
            type: "text",
            text: `Failed to retrieve DSL errors: ${error.message}`
          }]
        };
      }
    }
  );
}