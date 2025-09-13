const express = require('express');
const router = express.Router();
const ExamService = require('../services/exam-service');
const ScoringService = require('../services/scoring-service');

// Create new exam session
router.post('/', async (req, res) => {
  try {
    const { type, difficulty } = req.body;
    
    if (!type || !difficulty) {
      return res.status(400).json({ 
        error: 'Missing required fields: type and difficulty' 
      });
    }

    const exam = await ExamService.createExam(type, difficulty);
    res.json({ success: true, examId: exam.id, exam });
  } catch (error) {
    console.error('Error creating exam:', error);
    res.status(500).json({ error: 'Failed to create exam' });
  }
});

// Get current exam details
router.get('/current', async (req, res) => {
  try {
    const exam = ExamService.getCurrentExam();
    if (!exam) {
      return res.status(404).json({ error: 'No active exam found' });
    }

    res.json({
      id: exam.id,
      type: exam.type,
      difficulty: exam.difficulty,
      questions: exam.questions.map(q => ({
        id: q.id,
        title: q.title,
        description: q.description,
        points: q.points,
        flagged: q.flagged || false,
        completed: q.completed || false
      })),
      duration: exam.duration,
      startTime: exam.startTime,
      status: exam.status
    });
  } catch (error) {
    console.error('Error getting current exam:', error);
    res.status(500).json({ error: 'Failed to get exam details' });
  }
});

// Start exam timer
router.post('/start', async (req, res) => {
  try {
    const result = ExamService.startExam();
    res.json({ 
      success: true, 
      message: result.message || 'Exam started',
      timeRemaining: result.timeRemaining,
      status: result.status,
      currentQuestionIndex: result.currentQuestionIndex
    });
  } catch (error) {
    console.error('Error starting exam:', error);
    res.status(400).json({ error: error.message });
  }
});

// Flag current question
router.post('/flag', async (req, res) => {
  try {
    const exam = ExamService.getCurrentExam();
    if (!exam || exam.status !== 'in_progress') {
      return res.status(400).json({ error: 'No active exam found' });
    }

    const result = ExamService.flagCurrentQuestion();
    res.json({ success: true, flagged: result.flagged });
  } catch (error) {
    console.error('Error flagging question:', error);
    res.status(500).json({ error: 'Failed to flag question' });
  }
});

// Mark current question as complete
router.post('/complete', async (req, res) => {
  try {
    const exam = ExamService.getCurrentExam();
    if (!exam || exam.status !== 'in_progress') {
      return res.status(400).json({ error: 'No active exam found' });
    }

    ExamService.completeCurrentQuestion();
    res.json({ success: true, message: 'Question marked as complete' });
  } catch (error) {
    console.error('Error completing question:', error);
    res.status(500).json({ error: 'Failed to complete question' });
  }
});

// Submit exam for scoring
router.post('/submit', async (req, res) => {
  try {
    const exam = ExamService.getCurrentExam();
    if (!exam) {
      return res.status(404).json({ error: 'No exam found' });
    }

    if (exam.status === 'completed') {
      return res.status(400).json({ error: 'Exam already submitted' });
    }

    // End the exam
    ExamService.endExam();

    // Score the exam
    const results = await ScoringService.scoreExam(exam);
    
    res.json({
      success: true,
      score: results.totalScore,
      maxScore: results.maxScore,
      passed: results.totalScore >= 67,
      feedback: results.feedback,
      summary: results.summary
    });
  } catch (error) {
    console.error('Error submitting exam:', error);
    res.status(500).json({ error: 'Failed to submit exam' });
  }
});

// Get exam results
router.get('/results', async (req, res) => {
  try {
    const exam = ExamService.getCurrentExam();
    if (!exam || exam.status !== 'completed') {
      return res.status(400).json({ error: 'Exam not completed yet' });
    }

    if (!exam.results) {
      return res.status(404).json({ error: 'Results not available' });
    }

    res.json(exam.results);
  } catch (error) {
    console.error('Error getting results:', error);
    res.status(500).json({ error: 'Failed to get results' });
  }
});

// Reset exam for retry
router.post('/reset', async (req, res) => {
  try {
    const exam = ExamService.getCurrentExam();
    if (!exam) {
      return res.status(404).json({ error: 'No exam found to reset' });
    }

    ExamService.resetExamForRetry();
    res.json({ 
      success: true, 
      message: 'Exam reset successfully. You can start again.',
      exam: {
        id: exam.id,
        type: exam.type,
        difficulty: exam.difficulty,
        status: 'ready'
      }
    });
  } catch (error) {
    console.error('Error resetting exam:', error);
    res.status(500).json({ error: 'Failed to reset exam' });
  }
});

// Clear exam session completely
router.delete('/session', async (req, res) => {
  try {
    ExamService.resetExam();
    res.json({ 
      success: true, 
      message: 'Exam session cleared. Create a new exam to continue.' 
    });
  } catch (error) {
    console.error('Error clearing exam session:', error);
    res.status(500).json({ error: 'Failed to clear exam session' });
  }
});

module.exports = router;