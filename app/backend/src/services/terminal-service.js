const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');

// Store original signal handlers
let originalSigintHandlers = [];

// Custom signal handling for terminal sessions
function enableSignalPassthrough() {
  // Remove all existing SIGINT handlers completely
  originalSigintHandlers = process.listeners('SIGINT');
  process.removeAllListeners('SIGINT');

  // Don't add any SIGINT handler at all - let the signal pass through to parent terminal
  console.log('Removed all SIGINT handlers - CTRL+C should work in host terminal');
}

function disableSignalPassthrough() {
  // Restore original handlers
  process.removeAllListeners('SIGINT');
  originalSigintHandlers.forEach(handler => {
    process.on('SIGINT', handler);
  });
}

class TerminalService {
  constructor() {
    this.sessions = new Map();
    // Make available globally for signal handler
    global.terminalService = this;
  }

  initialize(namespace) {
    this.namespace = namespace;

    namespace.on('connection', (socket) => {
      console.log(`Terminal client connected: ${socket.id}`);

      this.createTerminalSession(socket);

      socket.on('disconnect', () => {
        console.log(`Terminal client disconnected: ${socket.id}`);
        this.destroyTerminalSession(socket.id);
      });
    });
  }

  createTerminalSession(socket) {
    try {
      // Create a new terminal process
      const shell = this.getShell();
      const args = this.getShellArgs();

      const terminal = spawn(shell, args, {
        cwd: '/tmp',
        env: {
          // Optimized environment for clean terminal output and kubectl formatting
          PATH: process.env.PATH,
          HOME: '/tmp',
          TERM: 'xterm',
          KUBECONFIG: process.env.KUBECONFIG || `${os.homedir()}/.kube/config`,
          COLUMNS: '120',  // Wider for better kubectl table formatting
          LINES: '30',
          LANG: 'en_US.UTF-8',  // Better for kubectl table formatting
          LC_ALL: 'en_US.UTF-8',
          // Force kubectl to use table format with proper spacing
          KUBECTL_EXTERNAL_DIFF: '',
          FORCE_COLOR: '0'  // Disable colors for cleaner output
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true, // Detach for proper signal handling
        shell: false
      });

      // Configure stdin properly
      if (terminal.stdin) {
        terminal.stdin.setEncoding('utf8');
      }

      // Store session
      this.sessions.set(socket.id, {
        terminal,
        socket
      });

      // Enable signal passthrough when first session is created
      if (this.sessions.size === 1) {
        enableSignalPassthrough();
        console.log('Signal passthrough enabled for terminal sessions');
      }

      // Handle terminal output with proper formatting
      terminal.stdout.on('data', (data) => {
        let output = data.toString();
        // Ensure proper line endings for terminal display
        output = output.replace(/\n/g, '\r\n');
        socket.emit('terminal-data', output);
      });

      terminal.stderr.on('data', (data) => {
        let output = data.toString();
        // Ensure proper line endings for terminal display
        output = output.replace(/\n/g, '\r\n');
        socket.emit('terminal-data', output);
      });

      // Handle terminal exit
      terminal.on('exit', (code) => {
        console.log(`Terminal session ${socket.id} exited with code ${code}`);
        socket.emit('terminal-data', `\r\n\x1b[31mTerminal session ended (exit code: ${code})\x1b[0m\r\n`);
        this.destroyTerminalSession(socket.id);
      });

      // Handle process errors
      terminal.on('error', (error) => {
        console.error(`Terminal process error for ${socket.id}:`, error);
        socket.emit('terminal-data', `\r\n\x1b[31mTerminal error: ${error.message}\x1b[0m\r\n`);
      });

      // Handle input - simple pass-through to terminal
      socket.on('terminal-input', (data) => {
        if (terminal && terminal.stdin && !terminal.killed) {
          // Pass all input directly to terminal (including CTRL+C)
          terminal.stdin.write(data);
        }
      });

      // Handle terminal resize
      socket.on('terminal-resize', (size) => {
        console.log(`Terminal resize requested: ${size.cols}x${size.rows}`);
      });

      // Initialize environment after shell starts
      setTimeout(() => {
        // Set up environment with proper terminal and kubectl settings
        terminal.stdin.write('export PS1="k8s-exam:/tmp$ "\n');
        terminal.stdin.write('alias k="kubectl"\n');
        terminal.stdin.write('export COLUMNS=120\n');
        terminal.stdin.write('export LINES=30\n');
        terminal.stdin.write('stty cols 120 rows 30 2>/dev/null || true\n');  // Set terminal size
        terminal.stdin.write('cd /tmp\n');
        terminal.stdin.write('clear\n');

        // Show welcome message after setup
        setTimeout(() => {
          const welcomeMessage = this.getWelcomeMessage();
          socket.emit('terminal-data', '\r\n' + welcomeMessage);
          socket.emit('terminal-data', 'k8s-exam:/tmp$ ');
        }, 500);
      }, 1000);

    } catch (error) {
      console.error('Error creating terminal session:', error);
      socket.emit('terminal-data', '\r\n\x1b[31mFailed to create terminal session\x1b[0m\r\n');
    }
  }

  destroyTerminalSession(socketId) {
    const session = this.sessions.get(socketId);
    if (session) {
      try {
        if (session.terminal && !session.terminal.killed) {
          session.terminal.kill('SIGTERM');

          // Force kill after 3 seconds if needed
          setTimeout(() => {
            if (!session.terminal.killed) {
              try {
                session.terminal.kill('SIGKILL');
              } catch (e) {
                console.warn('Terminal already killed:', e.message);
              }
            }
          }, 3000);
        }
      } catch (error) {
        console.warn('Error destroying terminal session:', error.message);
      }

      this.sessions.delete(socketId);

      // Disable signal passthrough when last session is destroyed
      if (this.sessions.size === 0) {
        disableSignalPassthrough();
        console.log('Signal passthrough disabled - no more terminal sessions');
      }
    }
  }

  getShell() {
    if (process.platform === 'win32') {
      return 'cmd.exe';
    } else {
      return process.env.SHELL || '/bin/bash';
    }
  }

  getShellArgs() {
    if (process.platform === 'win32') {
      return [];
    } else {
      return ['-i']; // Simple interactive shell
    }
  }

  getWelcomeMessage() {
    // Simple welcome message using proper terminal line endings
    return [
      '\x1b[36m╔══════════════════════════════════════════════════════╗\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m           \x1b[1mKubernetes Exam Terminal\x1b[0m               \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m╠══════════════════════════════════════════════════════╣\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m                                                      \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m  \x1b[32m✓\x1b[0m Connected to: \x1b[33mk8s-exam-cluster\x1b[0m            \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m  \x1b[33m⚡\x1b[0m kubectl available (alias: \x1b[37mk\x1b[0m)              \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m                                                      \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m  \x1b[35mQuick commands:\x1b[0m                                \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m    \x1b[37mk get nodes\x1b[0m     - View cluster nodes           \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m    \x1b[37mk get pods -A\x1b[0m   - View all pods                \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m    \x1b[37mk get ns\x1b[0m        - View namespaces              \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m                                                      \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m╚══════════════════════════════════════════════════════╝\x1b[0m\r\n'
    ].join('');
  }

  // Cleanup all sessions
  cleanup() {
    console.log('Cleaning up all terminal sessions...');
    for (const [socketId, session] of this.sessions) {
      this.destroyTerminalSession(socketId);
    }
    this.sessions.clear();
  }
}

// Export singleton instance
module.exports = new TerminalService();