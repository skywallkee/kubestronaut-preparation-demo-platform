import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import io from 'socket.io-client';
import 'xterm/css/xterm.css';

const Terminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const socketRef = useRef<any>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const terminal = new XTerm({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#ffffff',
      }
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.open(terminalRef.current);
    fitAddon.fit();

    // Connect to WebSocket for terminal communication
    const socket = io('/terminal');
    socketRef.current = socket;

    // Handle terminal data from server
    socket.on('terminal-data', (data: string) => {
      terminal.write(data);
    });

    // Send terminal input to server
    terminal.onData((data: string) => {
      socket.emit('terminal-input', data);
    });

    // Handle socket connection
    socket.on('connect', () => {
      console.log('Terminal WebSocket connected');
      terminal.write('\r\n🔗 Connected to Kubernetes cluster terminal\r\n');
      terminal.write('💡 Use kubectl commands to interact with your cluster\r\n');
      terminal.write('📖 Tip: Use "kubectl get nodes" to see available cluster nodes\r\n\r\n');
    });

    socket.on('disconnect', () => {
      console.log('Terminal WebSocket disconnected');
      terminal.write('\r\n❌ Disconnected from terminal\r\n');
    });

    // Handle terminal resize
    const handleResize = () => {
      fitAddon.fit();
      socket.emit('terminal-resize', {
        cols: terminal.cols,
        rows: terminal.rows
      });
    };

    window.addEventListener('resize', handleResize);

    // Welcome message
    terminal.write('Welcome to Kubernetes Exam Terminal\r\n');
    terminal.write('=====================================\r\n');
    terminal.write('Connecting to cluster...\r\n');

    return () => {
      window.removeEventListener('resize', handleResize);
      if (socket) {
        socket.disconnect();
      }
      if (terminal) {
        terminal.dispose();
      }
    };
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Terminal Header */}
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex space-x-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <span className="text-gray-300 text-sm font-medium">
            Kubernetes Terminal
          </span>
        </div>
        <div className="text-gray-400 text-xs">
          Cluster: k8s-exam-environment
        </div>
      </div>

      {/* Terminal Content */}
      <div
        ref={terminalRef}
        className="flex-1 p-0"
        style={{ backgroundColor: '#000000' }}
      />

      {/* Terminal Footer */}
      <div className="bg-gray-800 px-4 py-1 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center space-x-4">
            <span>📝 Tip: Use Ctrl+C to interrupt commands</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span>Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terminal;