#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Get the absolute path to the MCP script
const scriptPath = path.resolve(__dirname, 'structurizr-dsl-debugger-mcp.js');

// Define the MCP server configuration
const mcpConfig = {
  mcpServers: {
    'structurizr-dsl-debugger': {
      type: 'command',
      command: 'node',
      args: [scriptPath]
    }
  }
};

console.log('=== Structurizr DSL Debugger - Cursor Configuration ===');
console.log(`Script path: ${scriptPath}`);
console.log('\nMCP Configuration:');
console.log(JSON.stringify(mcpConfig, null, 2));

console.log('\nThis will add the "structurizr-dsl-debugger" MCP server to your Cursor configuration.');
console.log('Once added, you can use tools like:');
console.log('- mcp_structurizr_dsl_debugger_connectToBrowser');
console.log('- mcp_structurizr_dsl_debugger_getDslErrors');
console.log('- mcp_structurizr_dsl_debugger_fixDslError');

console.log('\nManual installation steps:');
console.log('1. Copy the MCP Configuration above to your clipboard');
console.log('2. In Cursor, open the settings (⌘, on Mac or Ctrl+, on Windows/Linux)');
console.log('3. Find the "Config" section and click "Edit as JSON"');
console.log('4. Add or merge the above configuration');
console.log('5. Save and restart Cursor');

console.log('\nOr try automatic configuration:');

// Try to locate the Cursor config file
const homedir = os.homedir();
let cursorConfigPath;

if (process.platform === 'darwin') {
  cursorConfigPath = path.join(homedir, 'Library', 'Application Support', 'Cursor', 'config.json');
} else if (process.platform === 'win32') {
  cursorConfigPath = path.join(homedir, 'AppData', 'Roaming', 'Cursor', 'config.json');
} else {
  // Linux and others
  cursorConfigPath = path.join(homedir, '.config', 'Cursor', 'config.json');
}

if (fs.existsSync(cursorConfigPath)) {
  console.log(`\nCursor config found at: ${cursorConfigPath}`);
  console.log('Would you like to automatically update your Cursor configuration? (y/n)');
  
  process.stdout.write('> ');
  process.stdin.once('data', (data) => {
    const response = data.toString().trim().toLowerCase();
    if (response === 'y' || response === 'yes') {
      try {
        // Read existing config
        const existingConfig = JSON.parse(fs.readFileSync(cursorConfigPath, 'utf-8'));
        
        // Backup the config
        const backupPath = `${cursorConfigPath}.backup-${Date.now()}`;
        fs.writeFileSync(backupPath, JSON.stringify(existingConfig, null, 2));
        console.log(`\nBackup created at: ${backupPath}`);
        
        // Merge in our MCP server config
        const updatedConfig = {
          ...existingConfig,
          mcpServers: {
            ...(existingConfig.mcpServers || {}),
            ...mcpConfig.mcpServers
          }
        };
        
        // Write the config back
        fs.writeFileSync(cursorConfigPath, JSON.stringify(updatedConfig, null, 2));
        console.log('\nCursor configuration updated successfully!');
        console.log('Please restart Cursor for the changes to take effect.');
      } catch (err) {
        console.error('\nError updating Cursor configuration:', err.message);
        console.log('Please update your configuration manually using the steps above.');
      }
    } else {
      console.log('\nNo changes made. Please update your configuration manually using the steps above.');
    }
    
    process.exit(0);
  });
} else {
  console.log(`\nCould not find Cursor config at: ${cursorConfigPath}`);
  console.log('Please update your configuration manually using the steps above.');
} 