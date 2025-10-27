const express = require('express');
const router = express.Router();
const fs = require('fs'); // Added for reading file system
const path = require('path'); // Added for handling file paths
const ExamService = require('../services/exam-service');
const ScoringService = require('../services/scoring-service');
const fs = require('fs');
const path = require('path');

// Create new exam session
router.post('/', async (req, res) => {
  try {
    const { type, difficulty, practiceMode } = req.body;

    if (!type || !difficulty) {
      return res.status(400).json({
        error: 'Missing required fields: type and difficulty'
      });
    }

    const exam = await ExamService.createExam(type, difficulty, practiceMode);
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
      practiceMode: exam.practiceMode || false,
      questions: exam.questions.map(q => ({
        id: q.id,
        originalId: q.originalId,
        title: q.title,
        description: q.description,
        points: q.points,
        flagged: q.flagged || false,
        completed: q.completed || false,
        // Only include solution/validations in practice mode
        solution: exam.practiceMode ? q.solution : undefined,
        validations: exam.practiceMode ? q.validations : undefined
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

    console.log(`Starting exam submission and scoring for ${exam.type}-${exam.difficulty}`);

    // End the exam
    ExamService.endExam();

    // Score the exam with detailed validation
    const results = await ScoringService.scoreExam(exam);

    // Store results in exam for later retrieval
    ExamService.setExamResults(results);

    console.log(`Exam scored: ${results.totalScore}/100 (${results.passed ? 'PASSED' : 'FAILED'})`);

    res.json({
      success: true,
      score: results.totalScore,
      maxScore: results.maxScore,
      passed: results.passed,
      pointsEarned: results.pointsEarned,
      totalPoints: results.totalPoints,
      questionsCorrect: results.questionsCorrect,
      totalQuestions: results.totalQuestions,
      completedQuestions: results.completedQuestions,
      feedback: results.feedback,
      summary: results.summary,
      detailedResults: true // Flag to indicate detailed results are available
    });
  } catch (error) {
    console.error('Error submitting exam:', error);
    res.status(500).json({
      error: 'Failed to submit exam',
      message: error.message
    });
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

// GET /api/exams/options
router.get('/options', (req, res) => {
  const questionBankPath = process.env.QUESTION_BANK_PATH ||
    path.join(__dirname, '../../../../question-bank');

  try {
    console.log('[exam-options] Resolving question bank from:', questionBankPath);

    if (!fs.existsSync(questionBankPath)) {
      console.warn(`Question bank path not found: ${questionBankPath}`);
      return res.json({ examTypes: [], difficultyLevels: {} });
    }

    const examTypes = [];
    const difficultyLevels = {};
    const questionCounts = {};

    const examTypeEntries = fs.readdirSync(questionBankPath, { withFileTypes: true });

    examTypeEntries.forEach((entry) => {
      if (!entry.isDirectory()) {
        return;
      }

      const examType = entry.name;
      const examTypePath = path.join(questionBankPath, examType);
      let hasAtLeastOneDifficulty = false;

      difficultyLevels[examType] = [];
      questionCounts[examType] = {};

      try {
        const difficultyEntries = fs.readdirSync(examTypePath, { withFileTypes: true });

        difficultyEntries.forEach((difficultyEntry) => {
          if (!difficultyEntry.isDirectory()) {
            return;
          }

          const difficultyName = difficultyEntry.name;
          const difficultyPath = path.join(examTypePath, difficultyName);

          try {
            const files = fs.readdirSync(difficultyPath);
            const questionFiles = files.filter((file) => file.endsWith('.json'));
            const hasQuestions = questionFiles.length > 0;

            if (hasQuestions) {
              difficultyLevels[examType].push(difficultyName);
              questionCounts[examType][difficultyName] = questionFiles.length;
              hasAtLeastOneDifficulty = true;
            }
          } catch (innerError) {
            console.warn(`Failed to read difficulty folder ${difficultyPath}:`, innerError.message);
          }
        });
      } catch (error) {
        console.warn(`Failed to read exam type folder ${examTypePath}:`, error.message);
      }

      if (hasAtLeastOneDifficulty) {
        examTypes.push(examType);
      } else {
        delete difficultyLevels[examType];
        delete questionCounts[examType];
      }
    });

    console.log('[exam-options] Exam types found:', examTypes);
    console.log('[exam-options] Difficulty levels found:', difficultyLevels);
    console.log('[exam-options] Question counts:', questionCounts);

    res.json({ examTypes, difficultyLevels, questionCounts });
  } catch (error) {
    console.error('Error loading exam options:', error);
    res.status(500).json({ error: 'Failed to load exam options' });
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

// --- Added Route for Exam Options ---

// Get available exam options (types, difficulties, counts)
router.get('/options', (req, res) => {
  // Define path relative to this file's location (__dirname)
  // Goes up from src/routes -> src -> backend -> app -> root, then into question-bank
  const questionBankDir = '/app/question-bank';
  console.log(`[Exam Options Route] Attempting to read from: ${questionBankDir}`);

  const examOptions = {
    examTypes: [],
    difficultyLevels: {},
    questionCounts: {}
  };

  try {
    // Read top-level directories in question-bank (ckad, cks, etc.)
    const examDirs = fs.readdirSync(questionBankDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const examType of examDirs) {
      examOptions.examTypes.push(examType);
      examOptions.difficultyLevels[examType] = [];
      examOptions.questionCounts[examType] = {};

      const examTypeDir = path.join(questionBankDir, examType);

      // Check if exam type directory exists before reading difficulties
      if (!fs.existsSync(examTypeDir)) {
          console.warn(`Directory not found for exam type: ${examTypeDir}`);
          continue; // Skip this exam type if directory is missing
      }

      // Read difficulty directories (beginner, intermediate, advanced)
      const difficultyDirs = fs.readdirSync(examTypeDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const difficulty of difficultyDirs) {
        examOptions.difficultyLevels[examType].push(difficulty);

        const difficultyDir = path.join(examTypeDir, difficulty);

         // Check if difficulty directory exists before reading files
        if (!fs.existsSync(difficultyDir)) {
            console.warn(`Directory not found for difficulty: ${difficultyDir}`);
            examOptions.questionCounts[examType][difficulty] = 0; // Set count to 0 if dir missing
            continue; // Skip this difficulty if directory is missing
        }

        // Count .json files in the difficulty directory
        const questionFiles = fs.readdirSync(difficultyDir)
          .filter(file => file.endsWith('.json'));

        examOptions.questionCounts[examType][difficulty] = questionFiles.length;
      }
    }

    // Send the compiled options object as JSON
    res.json(examOptions);

  } catch (error) {
    console.error("Error reading question bank:", error);
    res.status(500).json({ error: "Failed to read question bank details" });
  }
});

// --- Export the router ---
module.exports = router;
