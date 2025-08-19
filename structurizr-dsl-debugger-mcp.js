// Structurizr DSL Debugger MCP Server for Cursor IDE
// This MCP server specifically captures and processes Structurizr DSL errors
// to help debug and fix syntax issues in workspace.dsl files.
//
// Usage:
//   1. Run the server: node structurizr-dsl-debugger-mcp.js
//   2. Connect to it from Cursor IDE using the MCP tools
//   3. Use environment variable STRUCTURIZR_PORT to customize Structurizr port (default: 8080)
//      Example: STRUCTURIZR_PORT=9090 node structurizr-dsl-debugger-mcp.js

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { z } = require('zod');

// Configuration
const CONFIG = {
  logDir: path.join(__dirname, 'logs'),
  dslLogFile: path.join(__dirname, 'logs', 'structurizr-dsl-errors.json'),
  debugPort: 9222,
  structurizrPort: process.env.STRUCTURIZR_PORT || 8080 // Default Structurizr port
};

// Ensure log directory exists
if (!fs.existsSync(CONFIG.logDir)) {
  fs.mkdirSync(CONFIG.logDir, { recursive: true });
}

// Initialize empty DSL errors file if it doesn't exist
if (!fs.existsSync(CONFIG.dslLogFile)) {
  fs.writeFileSync(CONFIG.dslLogFile, '[]', 'utf-8');
}

// Set up MCP server
const server = new McpServer({
  name: 'structurizr-dsl-debugger',
  version: '1.1.0',
  description: 'Captures and processes Structurizr DSL errors for debugging in Cursor IDE'
});

// Browser launch tool
server.registerTool(
  'launchBrowser',
  {
    title: 'Launch Browser',
    description: 'Launches a browser instance for Structurizr debugging with error monitoring',
    inputSchema: {
      url: z.string().describe('The URL to navigate to').optional(),
      headless: z.boolean().default(false).describe('Whether to run the browser in headless mode'),
      structurizrPort: z.number().default(CONFIG.structurizrPort).describe('The port Structurizr is running on')
    }
  },
  async ({ url, headless = false, structurizrPort = CONFIG.structurizrPort }) => {
    try {
      // Launch browser with debugging
      const browser = await puppeteer.launch({
        headless: headless ? 'new' : false,
        args: [
          `--remote-debugging-port=${CONFIG.debugPort}`,
          `--user-data-dir=${path.join(__dirname, 'chrome-data')}`
        ]
      });
      
      // If no specific URL is provided, default to Structurizr
      if (!url || url === '') {
        url = `http://localhost:${structurizrPort}`;
      }
      
      const pages = await browser.pages();
      const page = pages[0];
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      // Setup monitoring for DSL errors
      await page.evaluate(() => {
        // Monitor for error messages in the DOM
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
              const errorElements = document.querySelectorAll('.error');
              errorElements.forEach((errorElement) => {
                const errorText = errorElement.textContent;
                if (errorText && errorText.includes('workspace.dsl')) {
                  console.error('DSL Error:', errorText);
                }
              });
            }
          });
        });
        
        // Start observing changes to the DOM
        observer.observe(document.body, { childList: true, subtree: true });
        console.log('Structurizr DSL error monitor initialized');
      });
      
      // Listen for console logs
      page.on('console', message => {
        if (message.type() === 'error' && message.text().includes('workspace.dsl')) {
          processDslError(message.text());
        }
      });
      
      return {
        content: [{
          type: "text",
          text: `Browser launched and navigated to ${url}\nNote: Error monitoring has been set up for Structurizr DSL errors`
        }]
      };
    } catch (error) {
      console.error('Error launching browser:', error);
      return {
        content: [{
          type: "text",
          text: `Failed to launch browser: ${error.message}`
        }]
      };
    }
  }
);

// Connect to existing browser
server.registerTool(
  'connectToBrowser',
  {
    title: 'Connect to Browser',
    description: 'Connects to an existing browser instance running in debug mode',
    inputSchema: {
      debugPort: z.number().default(CONFIG.debugPort).describe('The debugging port of the browser'),
      structurizrPort: z.number().default(CONFIG.structurizrPort).describe('The port Structurizr is running on')
    }
  },
  async ({ debugPort = CONFIG.debugPort, structurizrPort = CONFIG.structurizrPort }) => {
    try {
      const browser = await puppeteer.connect({
        browserURL: `http://localhost:${debugPort}`,
        defaultViewport: null
      });
      
      const pages = await browser.pages();
      if (pages.length === 0) {
        return {
          content: [{
            type: "text",
            text: "No pages found in the browser"
          }]
        };
      }
      
      // Find Structurizr page with customizable port
      const structurizrPage = pages.find(page => page.url().includes(`localhost:${structurizrPort}`));
      if (!structurizrPage) {
        const availablePages = await Promise.all(pages.map(p => p.url()));
        return {
          content: [{
            type: "text",
            text: `Structurizr page not found on port ${structurizrPort}\nAvailable pages: ${availablePages.join(', ')}`
          }]
        };
      }
      
      // Listen for console logs
      structurizrPage.on('console', message => {
        if (message.type() === 'error' && message.text().includes('workspace.dsl')) {
          processDslError(message.text());
        }
      });
      
      return {
        content: [{
          type: "text",
          text: `Connected to Structurizr page at ${await structurizrPage.url()}\nNote: Error monitoring has been set up for DSL errors`
        }]
      };
    } catch (error) {
      console.error('Error connecting to browser:', error);
      return {
        content: [{
          type: "text",
          text: `Failed to connect to browser: ${error.message}`
        }]
      };
    }
  }
);

// Get DSL errors
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

// Clear DSL errors
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

// Fix DSL error
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

// Manually process a DSL error
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

// Start the MCP server with stdio transport
const transport = new StdioServerTransport();
server.connect(transport);
console.log('"Structurizr DSL Error Capture" MCP Server running');

// Test the processDslError function with an example error
processDslError('workspace.dsl: Unexpected tokens (expected: include, exclude, autolayout, default, animation, title, description, properties) at line 776 of /usr/local/structurizr/workspace.dsl: dynamic "ErrorHandlingFlow" {'); 