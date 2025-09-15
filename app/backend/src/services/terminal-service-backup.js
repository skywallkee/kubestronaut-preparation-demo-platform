const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');

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
      // Create bash environment file with kubectl alias and proper settings
      this.createBashEnvironment();

      // Create a new terminal process with proper interactive configuration
      const shell = this.getShell();
      const args = this.getShellArgs();
      
      const terminal = spawn(shell, args, {
        cwd: '/tmp',  // Use neutral directory
        env: {
          // Minimal environment to prevent host system interference
          PATH: process.env.PATH,
          HOME: '/tmp',
          TERM: 'xterm-256color',
          KUBECONFIG: process.env.KUBECONFIG || `${os.homedir()}/.kube/config`,
          FORCE_COLOR: '1'
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });

      // Ensure stdin is properly configured for input
      if (terminal.stdin) {
        terminal.stdin.setEncoding('utf8');
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

      // Handle input from client - let shell handle echoing
      socket.on('terminal-input', (data) => {
        if (terminal && terminal.stdin && !terminal.killed) {
          // Handle CTRL+C (0x03) - send to terminal but don't propagate to parent
          if (data === '\x03') {
            try {
              // Send CTRL+C to the terminal process, not parent Node.js process
              terminal.stdin.write(data);
              // Also send SIGINT to be sure
              process.kill(terminal.pid, 'SIGINT');
            } catch (e) {
              console.warn('Failed to handle CTRL+C:', e.message);
            }
            // Explicitly prevent propagation to parent terminal
            return false;
          }

          // Send input directly to shell
          terminal.stdin.write(data);
        }
      });

      // Handle terminal resize (no-op for basic spawn, but keep for compatibility)
      socket.on('terminal-resize', (size) => {
        // Basic spawn doesn't support resize, but we can store the info
        console.log(`Terminal resize requested: ${size.cols}x${size.rows}`);
      });

      // Wait for shell to initialize, then set up environment
      setTimeout(() => {
        // Send environment setup commands silently
        terminal.stdin.write('export PS1="k8s-exam:/tmp$ "; alias k="kubectl"; cd /tmp; clear\n');

        // Wait for commands to execute, then show welcome
        setTimeout(() => {
          const welcomeMessage = this.getWelcomeMessage();
          socket.emit('terminal-data', welcomeMessage);
          socket.emit('terminal-data', '\nk8s-exam:/tmp$ ');
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

  createBashEnvironment() {
    const bashRcContent = `#!/bin/bash
# Kubernetes Exam Environment Configuration

# Clear any existing aliases/functions
unalias -a 2>/dev/null || true

# Set up kubectl alias
alias k='kubectl'

# Enable bash completion for kubectl and k alias (if available)
if command -v kubectl >/dev/null 2>&1; then
    source <(kubectl completion bash) 2>/dev/null || true
    complete -F __start_kubectl k 2>/dev/null || true
fi

# Improve terminal behavior
set +H  # Disable history expansion
export HISTCONTROL=ignoredups:erasedups  # Remove duplicate commands
export HISTSIZE=1000
export HISTFILESIZE=2000

# Clean PS1 prompt - avoid host system interference
export PS1='k8s-exam:/tmp$ '

# Enable colors
export TERM=xterm-256color
export CLICOLOR=1

# Ensure we're in the right directory
cd /tmp 2>/dev/null || true

# Display that we're ready
echo "🚀 Kubernetes exam environment loaded (k=kubectl alias available)"
`;

    try {
      fs.writeFileSync('/tmp/.bashrc_exam', bashRcContent);
      // Make it executable
      fs.chmodSync('/tmp/.bashrc_exam', 0o755);
    } catch (error) {
      console.warn('Failed to create bash environment file:', error.message);
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
      // Interactive shell - keep it simple to avoid argument parsing issues
      return ['-i'];
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
      '\x1b[36m║\x1b[0m  \x1b[33m⚡\x1b[0m kubectl and helm are available (k=kubectl alias set)       \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m  \x1b[34m📚\x1b[0m Use standard Kubernetes commands to solve questions        \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m                                                                  \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m  \x1b[35mQuick commands:\x1b[0m                                              \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m    \x1b[37mkubectl get nodes\x1b[0m (or \x1b[37mk get nodes\x1b[0m)   - View cluster nodes  \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m    \x1b[37mkubectl get pods -A\x1b[0m (or \x1b[37mk get pods -A\x1b[0m) - View all pods       \x1b[36m║\x1b[0m\r\n',
      '\x1b[36m║\x1b[0m    \x1b[37mkubectl config current-context\x1b[0m       - Current context     \x1b[36m║\x1b[0m\r\n',
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