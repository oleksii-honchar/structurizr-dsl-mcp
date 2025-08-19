const { z } = require('zod');
const fs = require('fs');

const { CONFIG } = require('../config');

// Generate a suggestion based on the error type
function getSuggestionForError(message, context) {
  if (message.includes('Unexpected tokens') && context.includes('dynamic')) {
    return {
      issue: "The dynamic view syntax is incorrect. It needs a container/component identifier AND key.",
      fix: "Correct syntax: 'dynamic ContainerName ErrorHandlingFlow {'\nAlternatively: 'dynamic ComponentName ErrorHandlingFlow {'"
    };
  }
  
  if (message.includes('Unknown relationship') || message.includes('relationship')) {
    return {
      issue: "There's a relationship defined between components that doesn't exist or has incorrect syntax",
      fix: "Check the relationship syntax and ensure both components exist: '<source> -> <destination> \"description\"'"
    };
  }
  
  // Generic suggestion
  return {
    issue: "Syntax error in the DSL file",
    fix: "Check the documentation at https://structurizr.com/dsl for correct syntax"
  };
}

// Process a Structurizr DSL error
function processDslError(errorText) {
  console.log('Processing DSL error:', errorText);
  
  // Extract file path, line number, and error details
  const match = errorText.match(/workspace\.dsl: (.*?) at line (\d+) of ([^:]+):(.*)/);
  
  if (match) {
    const [_, errorMessage, lineNumber, filePath, errorContext] = match;
    
    const dslError = {
      timestamp: new Date().toISOString(),
      type: 'DSL',
      message: errorMessage.trim(),
      filename: filePath.trim(),
      line: parseInt(lineNumber, 10),
      column: 1,
      context: errorContext.trim(),
      suggestion: getSuggestionForError(errorMessage.trim(), errorContext.trim())
    };
    
    // Log in vscode diagnostic-like format
    const dslErrors = [];
    if (fs.existsSync(CONFIG.dslLogFile)) {
      try {
        const existingErrors = JSON.parse(fs.readFileSync(CONFIG.dslLogFile, 'utf-8'));
        dslErrors.push(...existingErrors);
      } catch (e) {
        console.error('Error reading existing DSL errors:', e);
      }
    }
    
    // Add new error
    dslErrors.push({
      source: 'Structurizr DSL',
      severity: 'Error',
      message: dslError.message,
      file: dslError.filename,
      line: dslError.line,
      column: dslError.column,
      code: 'dsl-syntax',
      relatedInformation: [
        {
          message: `Context: ${dslError.context}`,
          file: dslError.filename,
          line: dslError.line,
          column: dslError.column
        }
      ],
      suggestion: dslError.suggestion,
      timestamp: dslError.timestamp
    });
    
    // Write to log file
    fs.writeFileSync(CONFIG.dslLogFile, JSON.stringify(dslErrors, null, 2));
    console.log('DSL error processed and saved');
    
    return dslError;
  } else {
    console.log('Could not parse DSL error format');
    return null;
  }
}

export const registerProcessDslErrorTool = (server) => {
  server.registerTool(
    'processDslError',
    {
      title: 'Process DSL Error',
      description: 'Manually processes and parses a DSL error text to extract structured error information',
      inputSchema: {
        errorText: z.string().describe('The DSL error text to process')
      }
    },
    async ({ errorText }) => {
      try {
        const dslError = processDslError(errorText);
        if (dslError) {
          return {
            content: [{
              type: "text",
              text: `DSL error processed successfully:\n\nError: ${dslError.message}\nFile: ${dslError.filename}\nLine: ${dslError.line}\nContext: ${dslError.context}\n\nSuggestion:\n${dslError.suggestion.issue}\nFix: ${dslError.suggestion.fix}`
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: "Failed to parse DSL error format. Please ensure the error text follows the expected Structurizr DSL error format."
            }]
          };
        }
      } catch (error) {
        console.error('Error processing DSL error:', error);
        return {
          content: [{
            type: "text",
            text: `Failed to process DSL error: ${error.message}`
          }]
        };
      }
    }
  );
}