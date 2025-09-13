const { spawn } = require('child_process');
const os = require('os');

class TerminalService {
  constructor() {
    this.sessions = new Map();
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
      // Create a new terminal process with proper interactive configuration
      const shell = this.getShell();
      const args = this.getShellArgs();
      
      const terminal = spawn(shell, args, {
        cwd: process.env.HOME || process.cwd(),
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          KUBECONFIG: process.env.KUBECONFIG || `${os.homedir()}/.kube/config`,
          PS1: '\\[\\e[32m\\]k8s-exam\\[\\e[0m\\]:\\[\\e[34m\\]\\w\\[\\e[0m\\]$ ',
          // Important: Force interactive mode
          FORCE_COLOR: '1',
          NODE_NO_READLINE: '1'
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });

      // Set stdin to raw mode equivalent for better input handling
      if (terminal.stdin && terminal.stdin.setRawMode) {
        terminal.stdin.setRawMode(true);
      }

      // Store session
      this.sessions.set(socket.id, {
        terminal,
        socket
      });

      // Handle terminal output
      terminal.stdout.on('data', (data) => {
        socket.emit('terminal-data', data.toString());
      });

      terminal.stderr.on('data', (data) => {
        socket.emit('terminal-data', data.toString());
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

      // Handle input from client with proper echoing
      socket.on('terminal-input', (data) => {
        if (terminal && terminal.stdin && !terminal.killed) {
          // For basic functionality, we can echo the input back to show typing
          if (data === '\r') {
            // Enter key - send to process and echo newline
            terminal.stdin.write('\n');
            socket.emit('terminal-data', '\r\n');
          } else if (data === '\u007f' || data === '\b') {
            // Backspace - handle deletion
            terminal.stdin.write('\b \b');
            socket.emit('terminal-data', '\b \b');
          } else {
            // Regular character - send to process and echo back
            terminal.stdin.write(data);
            socket.emit('terminal-data', data);
          }
        }
      });

      // Handle terminal resize (no-op for basic spawn, but keep for compatibility)
      socket.on('terminal-resize', (size) => {
        // Basic spawn doesn't support resize, but we can store the info
        console.log(`Terminal resize requested: ${size.cols}x${size.rows}`);
      });

      // Send welcome message after a short delay
      setTimeout(() => {
        const welcomeMessage = this.getWelcomeMessage();
        socket.emit('terminal-data', welcomeMessage);
        // Send initial prompt
        socket.emit('terminal-data', '\r\n$ ');
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
          
          // Force kill after 3 seconds if process doesn't exit
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
    }
  }

  getShell() {
    // Use bash on Unix systems, cmd on Windows
    if (process.platform === 'win32') {
      return 'cmd.exe';
    } else {
      return process.env.SHELL || '/bin/bash';
    }
  }

  getShellArgs() {
    // Return appropriate shell arguments
    if (process.platform === 'win32') {
      return [];
    } else {
      return ['-l']; // Login shell to load full environment
    }
  }

  getWelcomeMessage() {
    // Get cluster info for display
    const clusterInfo = this.getClusterInfo();
    
    const messages = [
      '\x1b[36m╔══════════════════════════════════════════════════════════════════╗\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m               \x1b[1mKubernetes Exam Terminal Environment\x1b[0m               \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m╠══════════════════════════════════════════════════════════════════╣\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m                                                                  \x1b[36m║\x1b[0m\r\n',
      `\x1b[36m║\x1b[0m  \x1b[32m✓\x1b[0m Connected to cluster: \x1b[33m${clusterInfo.name}\x1b[0m${' '.repeat(Math.max(0, 29 - clusterInfo.name.length))}\x1b[36m║\x1b[0m\r\n`,
      `\x1b[36m║\x1b[0m  \x1b[34m🌐\x1b[0m Context: \x1b[37m${clusterInfo.context}\x1b[0m${' '.repeat(Math.max(0, 44 - clusterInfo.context.length))}\x1b[36m║\x1b[0m\r\n`,
      '\x1b[36m║\x1b[0m  \x1b[33m⚡\x1b[0m kubectl and helm are available for use                     \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m  \x1b[34m📚\x1b[0m Use standard Kubernetes commands to solve questions        \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m                                                                  \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m  \x1b[35mQuick commands:\x1b[0m                                              \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m    \x1b[37mkubectl get nodes\x1b[0m           - View cluster nodes          \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m    \x1b[37mkubectl get pods --all-namespaces\x1b[0m - View all pods          \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m    \x1b[37mkubectl config current-context\x1b[0m - Current context         \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m                                                                  \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m╚══════════════════════════════════════════════════════════════════╝\x1b[0m\r\n',
      '\r\n'
    ];

    return messages.join('');
  }

  getClusterInfo() {
    // Mock cluster information for now
    // In a real implementation, this would query the actual cluster
    const clusterName = process.env.CLUSTER_NAME || 'k8s-exam-cluster';
    const context = process.env.KUBE_CONTEXT || 'exam-context';
    
    return {
      name: clusterName,
      context: context
    };
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