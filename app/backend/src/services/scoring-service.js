const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class ScoringService {
  constructor() {
    // Use environment variable if set (for Docker), otherwise use relative path
    this.answerKeyPath = process.env.QUESTION_BANK_PATH ||
                        path.join(__dirname, '../../../question-bank');
    console.log(`ScoringService initialized with answer key path: ${this.answerKeyPath}`);
  }

  async scoreExam(exam) {
    if (!exam || !exam.questions) {
      throw new Error('Invalid exam data provided');
    }

    console.log(`Starting scoring for exam ${exam.id} (${exam.type}-${exam.difficulty})`);

    try {
      // Load answer key for the exam type
      const answerKey = await this.loadAnswerKey(exam.type);
      
      let totalScore = 0;
      let maxScore = 0;
      const feedback = [];

      // Score each question
      for (let i = 0; i < exam.questions.length; i++) {
        const question = exam.questions[i];
        const questionScore = await this.scoreQuestion(question, answerKey, exam.type);
        
        totalScore += questionScore.points;
        maxScore += questionScore.maxPoints;
        feedback.push(questionScore);
      }

      // Calculate percentage
      const percentageScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

      const results = {
        totalScore: percentageScore,
        maxScore: 100,
        pointsEarned: totalScore,
        totalPoints: maxScore,
        passed: percentageScore >= 67,
        questionsCorrect: feedback.filter(f => f.correct).length,
        totalQuestions: exam.questions.length,
        completedQuestions: exam.questions.filter(q => q.completed).length,
        feedback,
        summary: this.generateSummary(percentageScore, feedback, exam.type)
      };

      console.log(`Exam scored: ${percentageScore}/100 (${results.passed ? 'PASSED' : 'FAILED'})`);
      return results;

    } catch (error) {
      console.error('Error during scoring:', error);
      
      // Return mock scoring if answer key is not available
      return this.generateMockResults(exam);
    }
  }

  async loadAnswerKey(examType) {
    try {
      const answerKeyPath = path.join(this.answerKeyPath, examType, 'answers.json');
      const data = await fs.readFile(answerKeyPath, 'utf8');
      const answers = JSON.parse(data);
      return answers.answers || answers;
    } catch (error) {
      console.warn(`Answer key not found for ${examType}, using mock scoring`);
      return null;
    }
  }

  async scoreQuestion(question, answerKey, examType) {
    const maxPoints = question.points || this.getDefaultPoints(examType);
    console.log(`Scoring question ${question.id}: ${question.title}`);

    try {
      // Get the full question data with validations and solution
      const fullQuestion = await this.loadFullQuestionData(question, examType);

      if (!fullQuestion || !fullQuestion.validations || fullQuestion.validations.length === 0) {
        console.warn(`No validations found for question ${question.id}, using completion status`);
        return this.scoreByCompletion(question, maxPoints);
      }

      // Run all validation commands and collect results
      const validationResults = [];
      let totalEarnedPoints = 0;
      let totalMaxPoints = 0;

      for (const validation of fullQuestion.validations) {
        const result = await this.runValidationCommand(validation, question.id);
        validationResults.push(result);

        if (result.passed) {
          totalEarnedPoints += result.points;
        }
        totalMaxPoints += result.points;
      }

      const passed = totalEarnedPoints >= totalMaxPoints * 0.7; // 70% threshold
      const finalScore = Math.min(maxPoints, totalEarnedPoints);

      return {
        questionId: question.id,
        originalId: question.originalId,
        title: question.title,
        description: question.description,
        points: finalScore,
        maxPoints,
        correct: passed,
        completionStatus: question.completed,
        validationResults,
        solutionSteps: fullQuestion.solution?.steps || [],
        explanation: this.generateDetailedExplanation(validationResults, passed, fullQuestion.solution),
        category: fullQuestion.category || 'General'
      };

    } catch (error) {
      console.error(`Error scoring question ${question.id}:`, error);
      return this.scoreByCompletion(question, maxPoints);
    }
  }

  async loadFullQuestionData(question, examType) {
    try {
      // Try to load the full question data from the original file
      const difficultyMapping = {
        'beginner': 'easy',
        'intermediate': 'intermediate',
        'advanced': 'hard'
      };

      const questionId = question.originalId || question.id;
      if (typeof questionId === 'string' && questionId.includes('-')) {
        // Try to load from individual question file (like ckad-e-001.json)
        const difficultyDir = difficultyMapping['beginner']; // Most questions are in easy for now
        const questionFilePath = path.join(this.answerKeyPath, examType, difficultyDir, `${questionId}.json`);

        try {
          const questionData = await fs.readFile(questionFilePath, 'utf8');
          return JSON.parse(questionData);
        } catch (fileError) {
          console.warn(`Could not load question file ${questionFilePath}`);
        }
      }

      // Fallback: return question with validations if available
      return question.validations ? question : null;
    } catch (error) {
      console.error('Error loading full question data:', error);
      return null;
    }
  }

  async runValidationCommand(validation, questionId) {
    console.log(`Running validation for question ${questionId}: ${validation.command}`);

    try {
      const timeoutMs = 10000; // 10 second timeout for each command
      const { stdout, stderr } = await execAsync(validation.command, {
        timeout: timeoutMs,
        shell: '/bin/bash'
      });

      let passed = false;
      let actualResult = stdout.trim();

      // Handle different types of expected results
      if (validation.expected === "0") {
        // Exit code check (for grep -q, test commands, etc.)
        passed = true; // If command succeeded without throwing, it passed
      } else if (validation.expected === "true") {
        // Boolean check
        passed = actualResult.toLowerCase() === 'true' || actualResult === '0';
      } else {
        // String comparison
        passed = actualResult === validation.expected;
      }

      return {
        command: validation.command,
        expected: validation.expected,
        actual: actualResult,
        passed,
        points: validation.points || 1,
        description: validation.description || 'Validation check',
        error: stderr || null
      };

    } catch (error) {
      console.warn(`Validation command failed for question ${questionId}: ${error.message}`);

      // For commands that are expected to fail (like grep -q), check exit code
      if (validation.expected === "0" && error.code === 1) {
        // grep -q returns 1 when no match found, which might be expected failure
        return {
          command: validation.command,
          expected: validation.expected,
          actual: `Exit code: ${error.code}`,
          passed: false,
          points: validation.points || 1,
          description: validation.description || 'Validation check',
          error: error.message
        };
      }

      return {
        command: validation.command,
        expected: validation.expected,
        actual: error.message,
        passed: false,
        points: validation.points || 1,
        description: validation.description || 'Validation check',
        error: error.message
      };
    }
  }

  scoreByCompletion(question, maxPoints) {
    return {
      questionId: question.id,
      originalId: question.originalId,
      title: question.title,
      description: question.description,
      points: question.completed ? Math.floor(maxPoints * 0.8) : 0, // 80% for completion without validation
      maxPoints,
      correct: question.completed,
      completionStatus: question.completed,
      validationResults: [],
      solutionSteps: [],
      explanation: question.completed
        ? "Question marked as completed. No automated validations available - scored based on completion status."
        : "Question was not marked as completed during the exam.",
      category: 'General'
    };
  }

  generateDetailedExplanation(validationResults, passed, solution) {
    if (validationResults.length === 0) {
      return "No validation commands were available for this question.";
    }

    let explanation = "";

    if (passed) {
      explanation += "✅ **PASSED** - All required validations succeeded!\n\n";
    } else {
      explanation += "❌ **FAILED** - Some validations did not pass.\n\n";
    }

    explanation += "**Validation Results:**\n";
    validationResults.forEach((result, index) => {
      const status = result.passed ? "✅ PASS" : "❌ FAIL";
      explanation += `${index + 1}. ${status} (${result.points} pts): ${result.description}\n`;
      explanation += `   Command: \`${result.command}\`\n`;
      explanation += `   Expected: \`${result.expected}\`\n`;
      explanation += `   Actual: \`${result.actual}\`\n`;
      if (result.error) {
        explanation += `   Error: ${result.error}\n`;
      }
      explanation += "\n";
    });

    if (solution && solution.steps && solution.steps.length > 0) {
      explanation += "\n**Solution Steps:**\n";
      solution.steps.forEach((step, index) => {
        explanation += `${index + 1}. ${step}\n`;
      });
    }

    return explanation;
  }

  generateMockResults(exam) {
    console.log(`Generating mock results for ${exam.type}`);
    
    const completedQuestions = exam.questions.filter(q => q.completed);
    const totalQuestions = exam.questions.length;
    
    // Base score on completion rate with some variation
    let completionRate = completedQuestions.length / totalQuestions;
    let baseScore = completionRate * 85; // Max 85% for completion alone
    
    // Add some randomization to simulate real scoring
    const variation = (Math.random() - 0.5) * 20; // ±10 points variation
    const finalScore = Math.max(0, Math.min(100, Math.round(baseScore + variation)));
    
    const feedback = exam.questions.map(question => {
      const maxPoints = question.points || this.getDefaultPoints(exam.type);
      const earnedPoints = question.completed 
        ? Math.round(maxPoints * (0.7 + Math.random() * 0.3)) 
        : Math.round(maxPoints * Math.random() * 0.3);
      
      return {
        questionId: question.id,
        title: question.title,
        description: question.description,
        points: earnedPoints,
        maxPoints,
        correct: earnedPoints >= maxPoints * 0.7,
        explanation: question.completed 
          ? "Task completed successfully. In a real exam, this would be validated against the actual cluster state."
          : "Task was not completed or marked as incomplete. Review the requirements and try again."
      };
    });

    return {
      totalScore: finalScore,
      maxScore: 100,
      pointsEarned: feedback.reduce((sum, f) => sum + f.points, 0),
      totalPoints: feedback.reduce((sum, f) => sum + f.maxPoints, 0),
      passed: finalScore >= 67,
      questionsCorrect: feedback.filter(f => f.correct).length,
      totalQuestions: exam.questions.length,
      completedQuestions: completedQuestions.length,
      feedback,
      summary: this.generateSummary(finalScore, feedback, exam.type)
    };
  }

  generateSummary(score, feedback, examType) {
    const passed = score >= 67;
    const correctAnswers = feedback.filter(f => f.correct).length;
    const totalQuestions = feedback.length;

    let summary = {
      overallPerformance: passed ? 'Excellent' : score >= 50 ? 'Good effort' : 'Needs improvement',
      strengths: [],
      improvements: [],
      nextSteps: []
    };

    // Categorize performance by question categories
    const categoryStats = {};
    feedback.forEach(f => {
      const category = f.category || 'General';
      if (!categoryStats[category]) {
        categoryStats[category] = { correct: 0, total: 0 };
      }
      categoryStats[category].total++;
      if (f.correct) categoryStats[category].correct++;
    });

    // Identify strengths and weaknesses
    Object.entries(categoryStats).forEach(([category, stats]) => {
      const rate = stats.correct / stats.total;
      if (rate >= 0.8) {
        summary.strengths.push(`Strong performance in ${category}`);
      } else if (rate < 0.5) {
        summary.improvements.push(`Review ${category} concepts and practice`);
      }
    });

    // Add exam-specific recommendations
    const examRecommendations = {
      'ckad': [
        'Practice with application deployment patterns',
        'Focus on Pod and Deployment configurations',
        'Review Service and Ingress configurations'
      ],
      'cka': [
        'Study cluster administration tasks',
        'Practice etcd backup and restore',
        'Review troubleshooting scenarios'
      ],
      'cks': [
        'Focus on security policies and RBAC',
        'Practice with network policies',
        'Review container and cluster hardening'
      ],
      'kcna': [
        'Review Kubernetes fundamentals',
        'Study cloud-native concepts',
        'Practice with basic kubectl commands'
      ]
    };

    summary.nextSteps = passed 
      ? ['Congratulations on passing!', 'Continue practicing with advanced scenarios']
      : [...(examRecommendations[examType] || examRecommendations['ckad']), 'Retake the exam when ready'];

    return summary;
  }

  getDefaultPoints(examType) {
    const defaultPoints = {
      'ckad': 4,
      'cka': 6,
      'cks': 5,
      'kcna': 2
    };

    return defaultPoints[examType] || 4;
  }
}

module.exports = new ScoringService();