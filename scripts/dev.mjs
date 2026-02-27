import { spawn, execSync } from 'child_process';
import open from 'open';
import fs from 'fs';
import path from 'path';

const isWindows = process.platform === 'win32';
const lockFile = path.join(process.cwd(), '.next', 'dev', 'lock');

// Kill any existing next dev processes and remove lock file
try {
  if (isWindows) {
    execSync('taskkill /F /IM node.exe /FI "WINDOWTITLE eq next*" 2>nul', { stdio: 'ignore' });
  } else {
    execSync("pkill -f 'next dev' 2>/dev/null || true", { stdio: 'ignore' });
  }
  if (fs.existsSync(lockFile)) {
    fs.unlinkSync(lockFile);
  }
} catch (e) {
  // Ignore errors - process might not exist
}

await new Promise(resolve => setTimeout(resolve, 500));

const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
const nextDev = spawn(process.execPath, [nextBin, 'dev'], {
  stdio: ['inherit', 'pipe', 'pipe'],
});

let browserOpened = false;

const handleOutput = (data) => {
  const output = data.toString();
  process.stdout.write(output);

  if (!browserOpened) {
    const match = output.match(/Local:\s+http:\/\/localhost:(\d+)/);
    if (match) {
      const port = match[1];
      browserOpened = true;
      const chromeApp = isWindows ? 'chrome' : 'google chrome';
      open(`http://localhost:${port}`, { app: { name: chromeApp } });
    }
  }
};

nextDev.stdout.on('data', handleOutput);
nextDev.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

nextDev.on('close', (code) => {
  process.exit(code);
});
