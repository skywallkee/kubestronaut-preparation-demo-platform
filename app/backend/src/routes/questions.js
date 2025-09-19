const express = require('express');
const router = express.Router();
const ExamService = require('../services/exam-service');
const QuestionService = require('../services/question-provider/question-service');

// Get questions by exam type and difficulty (standalone endpoint)
router.get('/', async (req, res) => {
  try {
    const { exam_type, difficulty } = req.query;
    
    if (!exam_type || !difficulty) {
      return res.status(400).json({ 
        error: 'Missing required parameters: exam_type and difficulty' 
      });
    }

    const questions = await QuestionService.getQuestions(exam_type, difficulty);
    res.json(questions);
  } catch (error) {
    console.error('Error getting questions:', error);
    res.status(500).json({ error: 'Failed to get questions' });
  }
});

// Get current question
router.get('/current', async (req, res) => {
  try {
    const exam = ExamService.getCurrentExam();
    if (!exam) {
      return res.status(404).json({ error: 'No active exam found' });
    }

    const currentQuestion = exam.questions[exam.currentQuestionIndex];
    if (!currentQuestion) {
      return res.status(404).json({ error: 'No current question found' });
    }

    // Mark current question as viewed
    currentQuestion.viewed = true;

    res.json({
      question: {
        id: currentQuestion.id,
        title: currentQuestion.title,
        description: currentQuestion.description,
        points: currentQuestion.points,
        flagged: currentQuestion.flagged || false,
        completed: currentQuestion.completed || false,
        viewed: currentQuestion.viewed || false
      },
      currentIndex: exam.currentQuestionIndex,
      totalQuestions: exam.questions.length,
      progress: {
        completed: exam.questions.filter(q => q.completed).length,
        flagged: exam.questions.filter(q => q.flagged && !q.completed).length,
        viewed: exam.questions.filter(q => q.viewed).length
      }
    });
  } catch (error) {
    console.error('Error getting current question:', error);
    res.status(500).json({ error: 'Failed to get current question' });
  }
});

// Move to next question
router.post('/next', async (req, res) => {
  try {
    const exam = ExamService.getCurrentExam();
    if (!exam || exam.status !== 'in_progress') {
      return res.status(400).json({ error: 'No active exam found' });
    }

    const result = ExamService.nextQuestion();
    res.json({
      success: true,
      currentIndex: result.currentIndex,
      question: result.question,
      message: result.message
    });
  } catch (error) {
    console.error('Error moving to next question:', error);
    res.status(500).json({ error: 'Failed to move to next question' });
  }
});

// Get all flagged questions
router.get('/flagged', async (req, res) => {
  try {
    const exam = ExamService.getCurrentExam();
    if (!exam) {
      return res.status(404).json({ error: 'No active exam found' });
    }

    const flaggedQuestions = exam.questions
      .map((q, index) => ({ ...q, originalIndex: index }))
      .filter(q => q.flagged && !q.completed);

    res.json({
      flaggedQuestions: flaggedQuestions.map(q => ({
        id: q.id,
        title: q.title,
        points: q.points,
        originalIndex: q.originalIndex
      })),
      count: flaggedQuestions.length
    });
  } catch (error) {
    console.error('Error getting flagged questions:', error);
    res.status(500).json({ error: 'Failed to get flagged questions' });
  }
});

// Go to specific question
router.post('/goto', async (req, res) => {
  try {
    const { questionIndex } = req.body;
    const exam = ExamService.getCurrentExam();

    if (!exam || exam.status !== 'in_progress') {
      return res.status(400).json({ error: 'No active exam found' });
    }

    if (questionIndex < 0 || questionIndex >= exam.questions.length) {
      return res.status(400).json({ error: 'Invalid question index' });
    }

    const question = exam.questions[questionIndex];
    exam.currentQuestionIndex = questionIndex;

    // Mark question as viewed when navigating to it
    const ExamService = require('../services/exam-service');
    ExamService.markCurrentQuestionViewed();

    res.json({
      success: true,
      currentIndex: questionIndex,
      question: {
        id: question.id,
        title: question.title,
        description: question.description,
        points: question.points,
        flagged: question.flagged,
        completed: question.completed,
        viewed: question.viewed
      }
    });
  } catch (error) {
    console.error('Error going to question:', error);
    res.status(500).json({ error: 'Failed to go to question' });
  }
});

// Get question statistics
router.get('/stats', async (req, res) => {
  try {
    const exam = ExamService.getCurrentExam();
    if (!exam) {
      return res.status(404).json({ error: 'No active exam found' });
    }

    const stats = {
      total: exam.questions.length,
      completed: exam.questions.filter(q => q.completed).length,
      flagged: exam.questions.filter(q => q.flagged).length,
      remaining: exam.questions.filter(q => !q.completed).length,
      currentIndex: exam.currentQuestionIndex,
      totalPoints: exam.questions.reduce((sum, q) => sum + q.points, 0),
      earnedPoints: exam.questions.filter(q => q.completed).reduce((sum, q) => sum + q.points, 0)
    };

    res.json(stats);
  } catch (error) {
    console.error('Error getting question stats:', error);
    res.status(500).json({ error: 'Failed to get question statistics' });
  }
});

module.exports = router;