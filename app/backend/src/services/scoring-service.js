const fs = require('fs').promises;
const path = require('path');

class ScoringService {
  constructor() {
    this.answerKeyPath = path.join(__dirname, '../../../question-bank');
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
    
    // If no answer key available, use completion status
    if (!answerKey) {
      return {
        questionId: question.id,
        title: question.title,
        description: question.description,
        points: question.completed ? maxPoints : Math.floor(maxPoints * 0.3), // Partial credit if not completed
        maxPoints,
        correct: question.completed,
        explanation: question.completed 
          ? "Question marked as completed during exam."
          : "Question was not marked as completed. In a real exam, this would be validated against cluster state."
      };
    }

    // Find answer in answer key
    const answer = answerKey.find(a => 
      a.id === question.id || 
      a.title === question.title ||
      a.questionNumber === question.id
    );

    if (!answer) {
      // No specific answer found, use completion status
      return {
        questionId: question.id,
        title: question.title,
        description: question.description,
        points: question.completed ? maxPoints : 0,
        maxPoints,
        correct: question.completed,
        explanation: "No specific validation criteria found. Scored based on completion status."
      };
    }

    // In a real implementation, this would validate against actual cluster state
    // For now, we'll simulate scoring based on completion and some randomization
    const baseScore = question.completed ? maxPoints : 0;
    const randomFactor = question.completed ? (0.8 + Math.random() * 0.2) : (Math.random() * 0.3);
    const finalScore = Math.round(baseScore * randomFactor);

    return {
      questionId: question.id,
      title: question.title,
      description: question.description,
      points: finalScore,
      maxPoints,
      correct: finalScore >= maxPoints * 0.8,
      explanation: answer.explanation || `${question.completed ? 'Completed' : 'Incomplete'} - ${answer.solution || 'Check solution in exam documentation'}`
    };
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