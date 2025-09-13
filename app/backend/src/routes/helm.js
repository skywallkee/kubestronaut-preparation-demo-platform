const express = require('express');
const router = express.Router();
const HelmService = require('../services/helm-generator/helm-service');

// Generate Helm chart for exam
router.post('/generate', async (req, res) => {
  try {
    const { type, difficulty } = req.body;
    
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

    const chartPath = await HelmService.generateChart(type, difficulty);
    
    res.json({
      success: true,
      message: 'Helm chart generated successfully',
      chartPath,
      downloadUrl: `/api/helm/download?type=${type}&difficulty=${difficulty}`
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
    let { type, difficulty } = req.query;
    
    // If not provided in query, try to get from current exam session
    if (!type || !difficulty) {
      const ExamService = require('../services/exam-service');
      const currentExam = ExamService.getCurrentExam();
      
      if (currentExam) {
        type = type || currentExam.type;
        difficulty = difficulty || currentExam.difficulty;
        console.log(`Using current exam parameters: ${type}-${difficulty}`);
      }
    }
    
    if (!type || !difficulty) {
      return res.status(400).json({ 
        error: 'Missing required parameters: type and difficulty. Please provide them as query parameters or create an exam session first.' 
      });
    }

    const chartBuffer = await HelmService.getChartArchive(type, difficulty);
    
    if (!chartBuffer) {
      return res.status(404).json({ 
        error: 'Chart not found. Please generate it first.' 
      });
    }

    const filename = `k8s-exam-${type}-${difficulty}.tgz`;
    
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