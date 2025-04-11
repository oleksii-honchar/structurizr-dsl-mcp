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
   git clone https://github.com/your-username/structurizr-dsl-debugger.git
   cd structurizr-dsl-debugger
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up Cursor IDE integration:
   ```bash
   npm run setup
   ```

## Usage

### Starting Structurizr

1. Run Structurizr Lite (if not already running):
   ```bash
   docker run -it --rm -p 8080:8080 -v /path/to/workspace:/workspace structurizr/lite
   ```

### Using the Debugger

1. Launch Chrome with remote debugging enabled:
   ```bash
   google-chrome --remote-debugging-port=9222 http://localhost:8080
   ```

2. Start the DSL debugger:
   ```bash
   # Standard start (default port 8080)
   npm start
   
   # With custom Structurizr port
   STRUCTURIZR_PORT=9090 npm start
   
   # Using the launcher with interactive prompts
   npm run debug
   ```

3. In Cursor IDE, use the MCP tools:
   ```
   connectToBrowser: { "debugPort": 9222, "structurizrPort": 8080 }
   getDslErrors: { "count": 5 }
   clearDslErrors: {}
   fixDslError: { "line": 776, "fix": "dynamic ContainerName ErrorHandlingFlow {" }
   ```

### Simplified Version

If you encounter issues with the main debugger, try the simplified version:

```bash
node simplified-dsl-debugger.js
```

With shorter MCP tool names:
```
connect: { "port": 9222 }
errors: { "count": 5 }
fix: { "line": 776, "solution": "dynamic ContainerName ErrorHandlingFlow {" }
```

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
- Try using the simplified version: `node simplified-dsl-debugger.js`
- Check the logs directory for captured errors
- Restart Cursor IDE

### Port Conflicts
- Structurizr default port is 8080
- If another application is using port 8080, you can:
  - Change the Structurizr port
  - Update the debugger to use the new port: `STRUCTURIZR_PORT=9090 npm start`

## License

MIT 