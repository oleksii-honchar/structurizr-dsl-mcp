// Structurizr DSL Debugger MCP Server for Cursor IDE
// This MCP server specifically captures and processes Structurizr DSL errors
// to help debug and fix syntax issues in workspace.dsl files.

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const fs = require('fs');

const { CONFIG } = require('./config');

const { registerLaunchBrowserTool } = require('./tools/launch-browser.tool');
const { registerConnectToBrowserTool } = require('./tools/connect-to-browser.tool');
const { registerGetDslErrorsTool } = require('./tools/get-dsl-errors.tool');
const { registerClearDslErrorsTool } = require('./tools/clear-dsl-errors.tool');
const { registerFixDslErrorTool } = require('./tools/fix-dsl-error.tool');
const { registerProcessDslErrorTool } = require('./tools/process-dsl-error.tool');

if (!fs.existsSync(CONFIG.logDir)) {
  fs.mkdirSync(CONFIG.logDir, { recursive: true });
}

if (!fs.existsSync(CONFIG.dslLogFile)) {
  fs.writeFileSync(CONFIG.dslLogFile, '[]', 'utf-8');
}

const server = new McpServer({
  name: 'structurizr-dsl-debugger',
  version: '1.1.0',
  description: 'Captures and processes Structurizr DSL errors for debugging in Cursor IDE'
});

registerLaunchBrowserTool(server);
registerConnectToBrowserTool(server);
registerGetDslErrorsTool(server);
registerClearDslErrorsTool(server);
registerFixDslErrorTool(server);
registerProcessDslErrorTool(server);

// Start the MCP server with stdio transport
const transport = new StdioServerTransport();
server.connect(transport);
console.log('"Structurizr DSL Error Capture" MCP Server running');
