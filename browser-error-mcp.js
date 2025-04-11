// Browser Error Streaming MCP Server for Cursor IDE
// This MCP server captures browser errors and streams them to Cursor IDE
// for debugging purposes.
//
// NOTE: This is a more general browser error capture solution.
// For Structurizr DSL specific error capturing, use cursor-dsl-mcp.js instead.

const { createServer } = require('http');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { SseServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { z } = require('zod');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const express = require('express');

// Configuration
const CONFIG = {
  port: process.env.PORT || 8765,
  logDir: process.env.LOG_DIR || path.join(__dirname, 'logs'),
  debugPort: process.env.DEBUG_PORT || 9222,
  browserUserDataDir: process.env.BROWSER_USER_DATA_DIR || path.join(__dirname, 'chrome-data'),
  receiveErrorPort: process.env.RECEIVE_ERROR_PORT || 8080, // Port to receive errors from (matches your testing port)
  dslLogFile: process.env.DSL_LOG_FILE || path.join(__dirname, 'logs', 'structurizr-dsl-errors.json')
};

// Ensure log directory exists
if (!fs.existsSync(CONFIG.logDir)) {
  fs.mkdirSync(CONFIG.logDir, { recursive: true });
}

// Active browser connections
const connections = new Map();

// Set up MCP server
const mcp = new McpServer({
  name: 'Browser Error Streaming',
  version: '1.0.0',
  description: 'Captures browser errors and streams them to Cursor IDE'
});

// Browser launch tool
mcp.tool(
  'mcp_browser_error_streaming_launchBrowser',
  {
    url: z.string().describe('The URL to navigate to'),
    headless: z.boolean().default(false).describe('Whether to run the browser in headless mode')
  },
  async ({ url, headless = false }) => {
    try {
      // Launch browser with debugging
      const browser = await puppeteer.launch({
        headless: headless ? 'new' : false,
        args: [
          `--remote-debugging-port=${CONFIG.debugPort}`,
          `--user-data-dir=${CONFIG.browserUserDataDir}`
        ]
      });
      
      const pages = await browser.pages();
      const page = pages[0];
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      // Set up error capturing
      await setupErrorCapturing(browser, page);
      
      // Inject error reporting script to forward errors directly to the existing port 8080
      await page.evaluate(() => {
        // Override global error handler
        window.addEventListener('error', function(event) {
          console.log('Error event captured:', event);
          const errorData = {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error ? event.error.stack : null,
            timestamp: new Date().toISOString()
          };
          console.log('Error data:', errorData);
          
          // Create a custom event that can be captured by the application running on port 8080
          const customEvent = new CustomEvent('browser-error', { 
            detail: errorData,
            bubbles: true,
            cancelable: true
          });
          
          // Dispatch the event on the document
          document.dispatchEvent(customEvent);
          
          // Also log it to console for easier debugging
          console.error('Browser error captured:', errorData.message);
          
          // Add the error to the DOM for visibility (creates a small floating error notice)
          const errorNotice = document.createElement('div');
          errorNotice.style.position = 'fixed';
          errorNotice.style.bottom = '10px';
          errorNotice.style.right = '10px';
          errorNotice.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
          errorNotice.style.color = 'white';
          errorNotice.style.padding = '10px';
          errorNotice.style.borderRadius = '5px';
          errorNotice.style.zIndex = '9999';
          errorNotice.style.maxWidth = '400px';
          errorNotice.style.wordBreak = 'break-word';
          errorNotice.textContent = `Error: ${errorData.message}`;
          document.body.appendChild(errorNotice);
          
          // Remove the notice after 5 seconds
          setTimeout(() => {
            errorNotice.remove();
          }, 5000);
        }, true);
        
        // Also catch unhandled promise rejections
        window.addEventListener('unhandledrejection', function(event) {
          const errorData = {
            message: `Unhandled Promise Rejection: ${event.reason}`,
            error: event.reason ? (event.reason.stack || event.reason.toString()) : 'Unknown error',
            timestamp: new Date().toISOString()
          };
          
          console.error('Unhandled rejection:', errorData);
          
          // Create and dispatch custom event
          const customEvent = new CustomEvent('browser-error', { 
            detail: errorData,
            bubbles: true,
            cancelable: true
          });
          document.dispatchEvent(customEvent);
        });
        
        console.log('Error capturing initialized for browser errors');
      });
      
      return {
        message: `Browser launched and navigated to ${url}`,
        debugUrl: `http://localhost:${CONFIG.debugPort}`,
        note: "Error reporting has been set up via custom events directly in the page",
        browserId: browser.process().pid
      };
    } catch (error) {
      console.error('Error launching browser:', error);
      return {
        error: `Failed to launch browser: ${error.message}`
      };
    }
  }
);

// Connect to browser tool
mcp.tool(
  'mcp_browser_error_streaming_connectToBrowser',
  {
    debugPort: z.number().default(CONFIG.debugPort).describe('The debugging port of the browser')
  },
  async ({ debugPort = CONFIG.debugPort }) => {
    try {
      // Connect to browser
      const browser = await puppeteer.connect({
        browserURL: `http://localhost:${debugPort}`,
        defaultViewport: null
      });
      
      const pages = await browser.pages();
      if (pages.length === 0) {
        return {
          error: 'No pages found in the browser'
        };
      }
      
      // Set up error capturing for all pages
      for (const page of pages) {
        await setupErrorCapturing(browser, page);
      }
      
      return {
        message: `Connected to browser on port ${debugPort}`,
        pageCount: pages.length,
        urls: await Promise.all(pages.map(page => page.url()))
      };
    } catch (error) {
      console.error('Error connecting to browser:', error);
      return {
        error: `Failed to connect to browser: ${error.message}`
      };
    }
  }
);

// Get recent errors tool
mcp.tool(
  'mcp_browser_error_streaming_getRecentErrors',
  {
    count: z.number().default(10).describe('Number of recent errors to retrieve')
  },
  async ({ count = 10 }) => {
    try {
      const logFile = path.join(CONFIG.logDir, 'browser-errors.log');
      if (!fs.existsSync(logFile)) {
        return {
          errors: []
        };
      }
      
      // Read log file and get most recent errors
      const content = fs.readFileSync(logFile, 'utf-8');
      const errors = content.split('\n\n')
        .filter(entry => entry.trim())
        .map(entry => {
          const [timestamp, ...errorLines] = entry.split('\n');
          return {
            timestamp,
            message: errorLines.join('\n')
          };
        })
        .slice(-count);
      
      return {
        errors
      };
    } catch (error) {
      console.error('Error retrieving errors:', error);
      return {
        error: `Failed to retrieve errors: ${error.message}`
      };
    }
  }
);

// Clear errors tool
mcp.tool(
  'mcp_browser_error_streaming_clearErrors',
  {},
  async () => {
    try {
      const logFile = path.join(CONFIG.logDir, 'browser-errors.log');
      if (fs.existsSync(logFile)) {
        fs.writeFileSync(logFile, '', 'utf-8');
      }
      
      return {
        message: 'Error log cleared'
      };
    } catch (error) {
      console.error('Error clearing log:', error);
      return {
        error: `Failed to clear error log: ${error.message}`
      };
    }
  }
);

// Check browser status tool
mcp.tool(
  'mcp_browser_error_streaming_checkBrowserStatus',
  {},
  async () => {
    try {
      const connectionStatus = Array.from(connections.entries()).map(([id, conn]) => ({
        id,
        url: conn.url,
        connected: conn.connected
      }));
      
      return {
        activeConnections: connectionStatus,
        count: connectionStatus.length
      };
    } catch (error) {
      console.error('Error checking browser status:', error);
      return {
        error: `Failed to check browser status: ${error.message}`
      };
    }
  }
);

// Toggle error streaming tool
mcp.tool(
  'mcp_browser_error_streaming_toggleErrorStreaming',
  {
    enabled: z.boolean().default(true).describe('Whether to enable error streaming')
  },
  async ({ enabled = true }) => {
    try {
      globalErrorStreamingEnabled = enabled;
      
      return {
        message: `Error streaming ${enabled ? 'enabled' : 'disabled'}`
      };
    } catch (error) {
      console.error('Error toggling streaming:', error);
      return {
        error: `Failed to toggle error streaming: ${error.message}`
      };
    }
  }
);

// Set up error capturing for a browser page
async function setupErrorCapturing(browser, page) {
  const cdpSession = await page.target().createCDPSession();
  
  // Enable relevant domains
  await cdpSession.send('Runtime.enable');
  await cdpSession.send('Network.enable');
  await cdpSession.send('Console.enable');
  
  // Generate an ID for this connection
  const connectionId = Date.now().toString();
  
  // Store connection information
  connections.set(connectionId, {
    browser,
    page,
    cdpSession,
    url: await page.url(),
    connected: true
  });
  
  // Listen for console errors
  cdpSession.on('Console.messageAdded', message => {
    if (message.message.level === 'error') {
      const errorText = message.message.text;
      
      // Detect and process Structurizr DSL errors automatically
      if (errorText && errorText.includes('workspace.dsl')) {
        processDslError(errorText);
      }
      
      logError(connectionId, {
        type: 'console',
        message: errorText,
        url: message.message.url,
        line: message.message.line,
        column: message.message.column
      });
    }
  });
  
  // Listen for JavaScript exceptions
  cdpSession.on('Runtime.exceptionThrown', exception => {
    logError(connectionId, {
      type: 'exception',
      message: exception.exceptionDetails.text,
      stack: exception.exceptionDetails.exception ? exception.exceptionDetails.exception.description : '',
      url: exception.exceptionDetails.url,
      line: exception.exceptionDetails.lineNumber,
      column: exception.exceptionDetails.columnNumber
    });
  });
  
  // Listen for network errors
  cdpSession.on('Network.loadingFailed', failure => {
    logError(connectionId, {
      type: 'network',
      message: `Network request failed: ${failure.errorText}`,
      resourceType: failure.type,
      requestId: failure.requestId
    });
  });
  
  // Listen for page errors
  page.on('error', error => {
    logError(connectionId, {
      type: 'page',
      message: error.message,
      stack: error.stack
    });
  });
  
  // Listen for page console errors
  page.on('console', message => {
    if (message.type() === 'error') {
      logError(connectionId, {
        type: 'console',
        message: message.text(),
        location: message.location()
      });
    }
  });
  
  // Listen for page close
  page.on('close', () => {
    connections.set(connectionId, {
      ...connections.get(connectionId),
      connected: false
    });
  });
  
  // Return connection ID
  return connectionId;
}

// Global flag for error streaming
let globalErrorStreamingEnabled = true;

// Log error to file and emit to connected clients
function logError(connectionId, error) {
  if (!globalErrorStreamingEnabled) {
    return;
  }
  
  try {
    // Format error message
    const timestamp = new Date().toISOString();
    const connection = connections.get(connectionId);
    const url = connection?.url || 'unknown';
    
    let formattedError = `[${timestamp}] [${error.type.toUpperCase()}] [${url}]\n`;
    
    if (error.message) {
      formattedError += `Message: ${error.message}\n`;
    }
    
    if (error.url) {
      formattedError += `URL: ${error.url}\n`;
    }
    
    if (error.line) {
      formattedError += `Location: Line ${error.line}, Column ${error.column}\n`;
    }
    
    if (error.stack) {
      formattedError += `Stack Trace:\n${error.stack}\n`;
    }
    
    // Log to file
    const logFile = path.join(CONFIG.logDir, 'browser-errors.log');
    fs.appendFileSync(logFile, `${formattedError}\n`);
    
    // Currently MCP doesn't have a direct emit functionality like socket.io
    // We'll log the error to file for now, but in a real implementation
    // you could use a custom event system or just return it in tool responses
    console.log('Error captured:', {
      timestamp,
      connectionId,
      url,
      error: {
        type: error.type,
        message: error.message,
        url: error.url,
        line: error.line,
        column: error.column,
        stack: error.stack
      }
    });
    
    console.log(`Error logged from ${url}: ${error.message}`);
  } catch (err) {
    console.error('Error processing browser error:', err);
  }
}

// Start MCP server with chosen transport (stdio or sse)
// For running directly with Node.js (stdio)
if (process.env.TRANSPORT === 'sse' || process.argv.includes('--sse')) {
  // For running as an HTTP server (sse)
  const httpServer = createServer();
  const transport = new SseServerTransport({ server: httpServer });
  mcp.connect(transport);
  
  httpServer.listen(CONFIG.port, () => {
    console.log(`Browser Error Streaming MCP Server running on port ${CONFIG.port} with SSE transport`);
  });
} else {
  // Default to stdio for direct use with Cursor
  const transport = new StdioServerTransport();
  mcp.connect(transport);
  console.log(`Browser Error Streaming MCP Server running with stdio transport`);
}

// Close connections when server exits
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  
  // Close all browser connections
  for (const [id, connection] of connections.entries()) {
    if (connection.connected) {
      try {
        await connection.browser.close();
      } catch (error) {
        console.error(`Error closing browser for connection ${id}:`, error);
      }
    }
  }
  
  process.exit(0);
});

const app = express();
const logDir = path.join(__dirname, 'logs');
const logFile = path.join(logDir, 'browser-errors.log');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

app.use(express.json());

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.post('/error', (req, res) => {
  const error = req.body;
  const logEntry = `[${error.timestamp}] Error in ${error.filename}:${error.lineno}:${error.colno}\n${error.message}\n${error.error || ''}\n\n`;
  
  fs.appendFileSync(logFile, logEntry);
  console.log('Error logged:', error.message);
  
  res.json({ success: true });
});

app.listen(8765, () => {
  console.log('Error logging server running on port 8765');
});

// Process Structurizr DSL error
function processDslError(errorText) {
  console.log('Processing Structurizr DSL error:', errorText);
  
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
      fullError: errorText
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
      suggestion: getSuggestionForError(dslError.message, dslError.context),
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

// Add DSL-specific MCP tools
mcp.tool(
  'mcp_browser_error_streaming_getDslErrors',
  {
    count: z.number().default(10).describe('Number of recent DSL errors to retrieve')
  },
  async ({ count = 10 }) => {
    try {
      if (!fs.existsSync(CONFIG.dslLogFile)) {
        return {
          errors: []
        };
      }
      
      // Read DSL errors
      const errors = JSON.parse(fs.readFileSync(CONFIG.dslLogFile, 'utf-8'));
      
      return {
        errors: errors.slice(-count)
      };
    } catch (error) {
      console.error('Error retrieving DSL errors:', error);
      return {
        error: `Failed to retrieve DSL errors: ${error.message}`
      };
    }
  }
);

mcp.tool(
  'mcp_browser_error_streaming_clearDslErrors',
  {},
  async () => {
    try {
      if (fs.existsSync(CONFIG.dslLogFile)) {
        fs.writeFileSync(CONFIG.dslLogFile, '[]', 'utf-8');
      }
      
      return {
        message: 'DSL error log cleared'
      };
    } catch (error) {
      console.error('Error clearing DSL log:', error);
      return {
        error: `Failed to clear DSL error log: ${error.message}`
      };
    }
  }
);

mcp.tool(
  'mcp_browser_error_streaming_fixDslError',
  {
    line: z.number().describe('Line number of the error'),
    fix: z.string().describe('Suggested fix for the error')
  },
  async ({ line, fix }) => {
    try {
      // This is a placeholder for a future implementation
      // In a real system, this would edit the workspace.dsl file
      return {
        message: `Suggested fix for line ${line}: ${fix}`,
        note: "This is a suggestion only. To apply the fix, you'll need to edit the workspace.dsl file."
      };
    } catch (error) {
      console.error('Error suggesting DSL fix:', error);
      return {
        error: `Failed to suggest DSL fix: ${error.message}`
      };
    }
  }
);

// Special tool to manually process a Structurizr DSL error
mcp.tool(
  'mcp_browser_error_streaming_processDslError',
  {
    errorText: z.string().describe('The DSL error text to process')
  },
  async ({ errorText }) => {
    try {
      const dslError = processDslError(errorText);
      if (dslError) {
        return {
          message: 'DSL error processed successfully',
          error: dslError
        };
      } else {
        return {
          error: 'Failed to parse DSL error format'
        };
      }
    } catch (error) {
      console.error('Error processing DSL error:', error);
      return {
        error: `Failed to process DSL error: ${error.message}`
      };
    }
  }
);
