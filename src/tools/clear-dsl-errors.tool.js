const fs = require('fs');

const { CONFIG } = require('../config');

export const registerClearDslErrorsTool = (server) => {
  server.registerTool(
    'clearDslErrors',
    {
      title: 'Clear DSL Errors',
      description: 'Clears all DSL errors from the log file',
      inputSchema: {}
    },
    async () => {
      try {
        fs.writeFileSync(CONFIG.dslLogFile, '[]', 'utf-8');
        return {
          content: [{
            type: "text",
            text: "DSL error log cleared successfully"
          }]
        };
      } catch (error) {
        console.error('Error clearing DSL log:', error);
        return {
          content: [{
            type: "text",
            text: `Failed to clear DSL error log: ${error.message}`
          }]
        };
      }
    }
  );
}