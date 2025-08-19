const { z } = require('zod');

export const registerFixDslErrorTool = (server) => {
  server.registerTool(
    'fixDslError',
    {
      title: 'Fix DSL Error',
      description: 'Provides suggested fixes for DSL errors at specific line numbers',
      inputSchema: {
        line: z.number().int().min(1).describe('Line number of the error'),
        fix: z.string().describe('Suggested fix for the error')
      }
    },
    async ({ line, fix }) => {
      return {
        content: [{
          type: "text",
          text: `Suggested fix for line ${line}: ${fix}\n\nNote: This is a suggestion only. To apply the fix, you should edit the workspace.dsl file manually.`
        }]
      };
    }
  );
}