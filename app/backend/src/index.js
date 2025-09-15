const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

const examRoutes = require('./routes/exam');
const questionRoutes = require('./routes/questions');
const helmRoutes = require('./routes/helm');
const terminalService = require('./services/terminal-service');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
}

// API Routes
app.use('/api/exams', examRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/helm', helmRoutes);

// Documentation proxy endpoint
app.get('/api/docs/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter required' });
    }

    let targetUrl = decodeURIComponent(url);

    // Extract the actual kubernetes.io URL from Google CSE redirect if needed
    const extractRealUrl = (googleUrl) => {
      try {
        const urlObj = new URL(googleUrl);
        const qParam = urlObj.searchParams.get('q');
        if (qParam && qParam.startsWith('http')) {
          return qParam;
        }
      } catch (e) {
        // Fallback: try to extract URL from the path
        const match = googleUrl.match(/q=(https?:\/\/[^&]+)/);
        if (match) {
          return decodeURIComponent(match[1]);
        }
      }
      return googleUrl;
    };

    // If it's a Google CSE redirect, extract the real URL
    if (targetUrl.includes('google.com/url')) {
      targetUrl = extractRealUrl(targetUrl);
    }

    // Only allow kubernetes.io and Google URLs for security
    if (!targetUrl.includes('kubernetes.io') && !targetUrl.includes('google.com')) {
      return res.status(403).json({ error: 'Only kubernetes.io URLs are allowed' });
    }

    // Fetch the content using built-in https module
    const https = require('https');
    const http = require('http');

    const fetchContent = (url) => {
      return new Promise((resolve, reject) => {
        const client = url.startsWith('https:') ? https : http;
        const options = {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        };

        client.get(url, options, (response) => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            return;
          }

          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => resolve({
            content: data,
            contentType: response.headers['content-type']
          }));
        }).on('error', reject);
      });
    };

    const result = await fetchContent(targetUrl);
    let content = result.content;

    // Modify the content to make Google CSE links work within the iframe
    content = content.replace(/href="https:\/\/www\.google\.com\/url\?([^"]*?)"/g, (match, params) => {
      // Extract the q parameter from the Google URL
      const qMatch = params.match(/q=([^&]*)/);
      if (qMatch) {
        const realUrl = decodeURIComponent(qMatch[1]);
        if (realUrl.includes('kubernetes.io')) {
          return `href="/api/docs/proxy?url=${encodeURIComponent(realUrl)}"`;
        }
      }
      return match;
    });

    // Also handle relative kubernetes.io links
    content = content.replace(/href="(\/[^"]*?)"/g, 'href="/api/docs/proxy?url=https://kubernetes.io$1"');

    // Set appropriate headers
    res.set('Content-Type', result.contentType || 'text/html');
    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.send(content);

  } catch (error) {
    console.error('Error proxying documentation:', error);
    res.status(500).json({ error: 'Failed to proxy documentation' });
  }
});

// Documentation URL resolver (keeping the old endpoint for compatibility)
app.get('/api/docs/resolve', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter required' });
    }

    // Extract the actual kubernetes.io URL from Google CSE redirect
    const extractRealUrl = (googleUrl) => {
      try {
        const urlObj = new URL(googleUrl);
        const qParam = urlObj.searchParams.get('q');
        if (qParam && qParam.startsWith('http')) {
          return qParam;
        }
      } catch (e) {
        // Fallback: try to extract URL from the path
        const match = googleUrl.match(/q=(https?:\/\/[^&]+)/);
        if (match) {
          return decodeURIComponent(match[1]);
        }
      }
      return googleUrl;
    };

    const realUrl = extractRealUrl(decodeURIComponent(url));

    // Only allow kubernetes.io URLs for security
    if (!realUrl.includes('kubernetes.io')) {
      return res.status(403).json({ error: 'Only kubernetes.io URLs are allowed' });
    }

    res.json({ resolvedUrl: realUrl });
  } catch (error) {
    console.error('Error resolving documentation URL:', error);
    res.status(500).json({ error: 'Failed to resolve URL' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Terminal WebSocket handling
const terminalNamespace = io.of('/terminal');
terminalService.initialize(terminalNamespace);

// Serve frontend for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});