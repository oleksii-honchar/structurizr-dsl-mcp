# Structurizr DSL Debugger for Cursor

A specialized tool for debugging Structurizr DSL syntax issues in Cursor IDE. This tool integrates with Cursor using the Model Context Protocol (MCP) to provide real-time Structurizr DSL error detection, analysis, and fix suggestions.

## Features

- 🔍 **Real-time error detection** - Automatically captures syntax errors from Structurizr DSL files
- 🛠️ **Suggested fixes** - Provides intelligent suggestions to correct common DSL errors
- 🔄 **Browser integration** - Connects to Chrome with Structurizr pages to monitor errors
- 🧩 **Cursor IDE integration** - Seamlessly integrates with Cursor using MCP tools
- ⚙️ **Configurable** - Support for custom Structurizr port configuration
- 📊 **Error history** - Maintains logs of captured errors for review

## Requirements

- Node.js 14+
- Cursor IDE
- Google Chrome with remote debugging enabled
- Structurizr Lite running locally (typically on port 8080)

## Installation

1. Clone this repository:
   ```bash
   git clone git@github.com:oleksii-honchar/structurizr-dsl-mcp.git
   cd structurizr-dsl-debugger
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up Cursor IDE integration automatically or manually:
   ```bash
   npm run setup
   ```

## Usage

1. Run Structurizr Lite in DSL workspace folder:

   ```bash
   docker run -it --rm -p 8080:8080 "$PWD":/usr/local/structurizr structurizr/lite
   ```

2. Launch Chrome with remote debugging enabled:

   ```bash
   # probably you need to add alias in you rc file, e.g. ~/.zshrc
   alias google-chrome="/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome"

   # then in terminal
   google-chrome --remote-debugging-port=9222 http://localhost:8080
   ```

3. In Cursor IDE, use the MCP tools:
   ```
   connectToBrowser: { "debugPort": 9222, "structurizrPort": 8080 }
   getDslErrors: { "count": 5 }
   clearDslErrors: {}
   fixDslError: { "line": 776, "fix": "dynamic ContainerName ErrorHandlingFlow {" }
   ```

**Note**: Cursor will start MCP server by itself, one don't need to start it manually

### Utility Scripts

- **Capture errors directly**:
  ```bash
  npm run capture
  ```

- **View captured errors**:
  ```bash
  npm run errors
  ```

## Troubleshooting

### Chrome Connection Issues
- Ensure Chrome is running with remote debugging enabled on port 9222
- Check if Chrome is already running with the `--remote-debugging-port` flag
- Try restarting Chrome with: `google-chrome --remote-debugging-port=9222 http://localhost:8080`

### MCP Tool Issues
- Verify the MCP server is running: `npm start`
- Check the logs directory for captured errors
- Restart Cursor IDE

### Port Conflicts
- Structurizr default port is 8080
- If another application is using port 8080, you can:
  - Change the Structurizr port
  - Update the debugger to use the new port: `STRUCTURIZR_PORT=9090 npm start`

## Tools not updated in Cursor

When MCP tool source code changed Cursor starts new process, so you need to delete old ones if it was not able to gracefully delete them. When Cursor restarted it start 4 processes for MCP tool. So, close Cursor, then use grep to find node zombie processes and deleted them

```bash
ps aux | grep structurizr-dsl-debugger-mcp.js
sudo kill -9 <>
```

## License

MIT 