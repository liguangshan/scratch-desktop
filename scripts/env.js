const { spawn } = require('child_process');
const args = process.argv.slice(2);

// Parse environment variables like NODE_ENV=production
const env = { ...process.env };
const path = require('path');

// Inject mirrors for China users to avoid download failures
env['ELECTRON_MIRROR'] = 'https://npmmirror.com/mirrors/electron/';
env['ELECTRON_BUILDER_BINARIES_MIRROR'] = 'https://npmmirror.com/mirrors/electron-builder-binaries/';

// Use local cache for electron-builder to avoid winCodeSign download/extraction issues
env['ELECTRON_BUILDER_CACHE'] = path.resolve(__dirname, '..', 'cache');

let commandIndex = 0;

while (commandIndex < args.length && args[commandIndex].includes('=')) {
    const [key, value] = args[commandIndex].split('=');
    env[key] = value;
    commandIndex++;
}

const command = args[commandIndex];
const commandArgs = args.slice(commandIndex + 1);

if (command) {
    // On Windows, npm/yarn run scripts are executed in cmd.exe by default, or PowerShell.
    // shell: true allows executing shell commands.
    const child = spawn(command, commandArgs, { env, stdio: 'inherit', shell: true });
    
    child.on('close', (code) => {
        process.exit(code);
    });
    
    child.on('error', (err) => {
        console.error(`Failed to start command: ${command}`, err);
        process.exit(1);
    });
}
