const express = require('express');
const router = express.Router();
const HelmService = require('../services/helm-generator/helm-service');

// Generate Helm chart for exam
router.post('/generate', async (req, res) => {
  try {
    const { type, difficulty, practiceMode } = req.body;

    if (!type || !difficulty) {
      return res.status(400).json({
        error: 'Missing required fields: type and difficulty'
      });
    }

    const validTypes = ['ckad', 'cka', 'cks', 'kcna'];
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid exam type' });
    }

    if (!validDifficulties.includes(difficulty)) {
      return res.status(400).json({ error: 'Invalid difficulty level' });
    }

    const chartPath = await HelmService.generateChart(type, difficulty, practiceMode);

    res.json({
      success: true,
      message: `Helm chart generated successfully${practiceMode ? ' (Practice Mode)' : ''}`,
      chartPath,
      downloadUrl: `/api/helm/download?type=${type}&difficulty=${difficulty}&practiceMode=${practiceMode || false}`
    });
  } catch (error) {
    console.error('Error generating Helm chart:', error);
    res.status(500).json({
      error: 'Failed to generate Helm chart',
      message: error.message
    });
  }
});

// Download generated Helm chart
router.get('/download', async (req, res) => {
  try {
    let { type, difficulty, practiceMode } = req.query;

    // Convert string parameters to proper types
    if (practiceMode !== undefined) {
      practiceMode = practiceMode === 'true' || practiceMode === true;
    }

    // If not provided in query, try to get from current exam session
    if (!type || !difficulty) {
      const ExamService = require('../services/exam-service');
      const currentExam = ExamService.getCurrentExam();

      if (currentExam) {
        type = type || currentExam.type;
        difficulty = difficulty || currentExam.difficulty;
        // Only use current exam's practiceMode if it wasn't explicitly provided in query
        if (practiceMode === undefined) {
          practiceMode = currentExam.practiceMode;
        }
        console.log(`Using parameters: ${type}-${difficulty}${practiceMode ? ' (Practice Mode)' : ''}`);
      }
    }

    // Default practiceMode to false if still undefined
    if (practiceMode === undefined) {
      practiceMode = false;
    }
    
    if (!type || !difficulty) {
      return res.status(400).json({ 
        error: 'Missing required parameters: type and difficulty. Please provide them as query parameters or create an exam session first.' 
      });
    }

    const chartBuffer = await HelmService.getChartArchive(type, difficulty, practiceMode);

    if (!chartBuffer) {
      return res.status(404).json({
        error: 'Chart not found. Please generate it first.'
      });
    }

    const filename = `k8s-exam-${type}-${difficulty}${practiceMode ? '-practice' : ''}.tgz`;
    
    res.set({
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': chartBuffer.length
    });

    res.send(chartBuffer);
  } catch (error) {
    console.error('Error downloading Helm chart:', error);
    res.status(500).json({ 
      error: 'Failed to download Helm chart',
      message: error.message 
    });
  }
});

// Apply Helm chart to cluster with streaming output (supports both POST and GET)
const handleStreamingApply = (req, res) => {
  let { type, difficulty, practiceMode } = req.method === 'POST' ? req.body : req.query;

  // Convert string parameters to proper types for GET requests
  if (req.method === 'GET' && practiceMode !== undefined) {
    practiceMode = practiceMode === 'true' || practiceMode === true;
  }

  // Default practiceMode to false if undefined
  if (practiceMode === undefined) {
    practiceMode = false;
  }

  console.log(`Apply request: ${type}-${difficulty}, practiceMode: ${practiceMode}`);

  if (!type || !difficulty) {
    return res.status(400).json({
      error: 'Missing required fields: type and difficulty'
    });
  }

  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Function to send SSE message
  const sendSSE = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Start the streaming apply process
  HelmService.applyChartWithStreaming(type, difficulty, sendSSE, practiceMode)
    .then((result) => {
      sendSSE('complete', result);
      res.end();
    })
    .catch((error) => {
      sendSSE('error', {
        success: false,
        error: error.message,
        output: error.stdout || '',
        stderr: error.stderr || ''
      });
      res.end();
    });

  // Handle client disconnect
  req.on('close', () => {
    console.log('Client disconnected from apply stream');
  });
};

// Support both POST and GET for streaming
router.post('/apply-stream', handleStreamingApply);
router.get('/apply-stream', handleStreamingApply);

// Apply Helm chart to cluster (legacy endpoint)
router.post('/apply', async (req, res) => {
  try {
    const { type, difficulty } = req.body;

    if (!type || !difficulty) {
      return res.status(400).json({
        error: 'Missing required fields: type and difficulty'
      });
    }

    // First ensure the chart is generated
    const chartPath = await HelmService.generateChart(type, difficulty);

    // Apply the chart to the cluster
    const result = await HelmService.applyChart(type, difficulty);

    if (result.success) {
      res.json({
        success: true,
        message: 'Helm chart applied successfully to cluster',
        releaseName: result.releaseName,
        namespace: result.namespace,
        output: result.output
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to apply Helm chart',
        output: result.output
      });
    }
  } catch (error) {
    console.error('Error applying Helm chart:', error);
    res.status(500).json({
      error: 'Failed to apply Helm chart to cluster',
      message: error.message,
      details: error.stderr || error.output
    });
  }
});

// Check if Helm chart is applied to cluster
router.get('/status', async (req, res) => {
  try {
    const { type, difficulty } = req.query;
    
    if (!type || !difficulty) {
      return res.status(400).json({ 
        error: 'Missing required query parameters: type and difficulty' 
      });
    }

    const status = await HelmService.checkChartStatus(type, difficulty);
    
    res.json({
      applied: status.applied,
      releaseName: status.releaseName,
      namespace: status.namespace,
      status: status.status,
      nodes: status.nodes,
      message: status.message
    });
  } catch (error) {
    console.error('Error checking Helm chart status:', error);
    res.status(500).json({ 
      error: 'Failed to check chart status',
      message: error.message 
    });
  }
});

// Get chart templates info
router.get('/templates', async (req, res) => {
  try {
    const templates = await HelmService.getAvailableTemplates();
    
    res.json({
      templates,
      count: templates.length
    });
  } catch (error) {
    console.error('Error getting chart templates:', error);
    res.status(500).json({ 
      error: 'Failed to get chart templates',
      message: error.message 
    });
  }
});

// Cleanup generated charts (utility endpoint)
router.delete('/cleanup', async (req, res) => {
  try {
    await HelmService.cleanupGeneratedCharts();
    
    res.json({
      success: true,
      message: 'Generated charts cleaned up successfully'
    });
  } catch (error) {
    console.error('Error cleaning up charts:', error);
    res.status(500).json({ 
      error: 'Failed to cleanup charts',
      message: error.message 
    });
  }
});

module.exports = router;