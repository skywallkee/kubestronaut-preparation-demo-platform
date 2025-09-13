const { v4: uuidv4 } = require('uuid');
const QuestionProvider = require('./question-provider/question-service');

class ExamService {
  constructor() {
    this.currentExam = null;
  }

  async createExam(type, difficulty) {
    // Load questions for the exam
    const questions = await QuestionProvider.getQuestions(type, difficulty);
    
    const exam = {
      id: uuidv4(),
      type,
      difficulty,
      questions: questions.map((q, index) => ({
        ...q,
        id: index + 1,
        flagged: false,
        completed: false
      })),
      duration: this.getDuration(type), // in seconds
      startTime: null,
      endTime: null,
      currentQuestionIndex: 0,
      status: 'ready', // ready, in_progress, completed
      results: null
    };

    this.currentExam = exam;
    console.log(`Created exam: ${type}-${difficulty} with ${questions.length} questions`);
    
    return exam;
  }

  getCurrentExam() {
    return this.currentExam;
  }

  startExam() {
    if (!this.currentExam) {
      throw new Error('No exam found. Please create an exam first.');
    }

    // If exam is already in progress, allow resume
    if (this.currentExam.status === 'in_progress') {
      console.log(`Resuming exam ${this.currentExam.id}`);
      return {
        ...this.currentExam,
        message: 'Exam resumed',
        timeRemaining: this.getTimeRemaining()
      };
    }

    // If exam is completed, reset it for a new attempt
    if (this.currentExam.status === 'completed') {
      console.log(`Resetting completed exam ${this.currentExam.id} for new attempt`);
      this.resetExamForRetry();
    }

    // Start the exam
    this.currentExam.startTime = new Date();
    this.currentExam.status = 'in_progress';
    
    console.log(`Started exam ${this.currentExam.id} at ${this.currentExam.startTime}`);
    
    return {
      ...this.currentExam,
      message: 'Exam started successfully',
      timeRemaining: this.currentExam.duration
    };
  }

  endExam() {
    if (!this.currentExam) {
      throw new Error('No active exam found');
    }

    this.currentExam.endTime = new Date();
    this.currentExam.status = 'completed';
    
    console.log(`Ended exam ${this.currentExam.id} at ${this.currentExam.endTime}`);
    
    return this.currentExam;
  }

  nextQuestion() {
    if (!this.currentExam || this.currentExam.status !== 'in_progress') {
      throw new Error('No active exam found');
    }

    const totalQuestions = this.currentExam.questions.length;
    
    // If we're at the last question, check for flagged questions
    if (this.currentExam.currentQuestionIndex >= totalQuestions - 1) {
      const flaggedIncomplete = this.currentExam.questions
        .findIndex((q, index) => q.flagged && !q.completed && index !== this.currentExam.currentQuestionIndex);
      
      if (flaggedIncomplete !== -1) {
        this.currentExam.currentQuestionIndex = flaggedIncomplete;
        return {
          currentIndex: flaggedIncomplete,
          question: this.currentExam.questions[flaggedIncomplete],
          message: 'Moved to flagged question'
        };
      } else {
        return {
          currentIndex: this.currentExam.currentQuestionIndex,
          question: this.currentExam.questions[this.currentExam.currentQuestionIndex],
          message: 'All questions reviewed. Ready to submit.'
        };
      }
    }

    // Move to next question
    this.currentExam.currentQuestionIndex += 1;
    const currentQuestion = this.currentExam.questions[this.currentExam.currentQuestionIndex];
    
    return {
      currentIndex: this.currentExam.currentQuestionIndex,
      question: currentQuestion,
      message: 'Moved to next question'
    };
  }

  flagCurrentQuestion() {
    if (!this.currentExam || this.currentExam.status !== 'in_progress') {
      throw new Error('No active exam found');
    }

    const currentQuestion = this.currentExam.questions[this.currentExam.currentQuestionIndex];
    if (!currentQuestion) {
      throw new Error('No current question found');
    }

    currentQuestion.flagged = !currentQuestion.flagged;
    
    // If question is completed and we're unflagging, keep it completed
    if (!currentQuestion.flagged && currentQuestion.completed) {
      currentQuestion.flagged = false;
    }

    console.log(`Question ${currentQuestion.id} flagged status: ${currentQuestion.flagged}`);
    
    return {
      flagged: currentQuestion.flagged,
      questionId: currentQuestion.id
    };
  }

  completeCurrentQuestion() {
    if (!this.currentExam || this.currentExam.status !== 'in_progress') {
      throw new Error('No active exam found');
    }

    const currentQuestion = this.currentExam.questions[this.currentExam.currentQuestionIndex];
    if (!currentQuestion) {
      throw new Error('No current question found');
    }

    currentQuestion.completed = true;
    currentQuestion.flagged = false; // Remove flag when marking as complete
    
    console.log(`Question ${currentQuestion.id} marked as completed`);
    
    return {
      completed: true,
      questionId: currentQuestion.id
    };
  }

  getExamProgress() {
    if (!this.currentExam) {
      return null;
    }

    const totalQuestions = this.currentExam.questions.length;
    const completedQuestions = this.currentExam.questions.filter(q => q.completed).length;
    const flaggedQuestions = this.currentExam.questions.filter(q => q.flagged).length;

    return {
      total: totalQuestions,
      completed: completedQuestions,
      flagged: flaggedQuestions,
      remaining: totalQuestions - completedQuestions,
      progress: Math.round((completedQuestions / totalQuestions) * 100)
    };
  }

  getDuration(examType) {
    const durations = {
      'ckad': 7200, // 2 hours
      'cka': 10800, // 3 hours
      'cks': 7200,  // 2 hours
      'kcna': 5400  // 1.5 hours
    };

    return durations[examType] || 7200;
  }

  getTimeRemaining() {
    if (!this.currentExam || !this.currentExam.startTime) {
      return 0;
    }

    const now = new Date();
    const elapsed = Math.floor((now - this.currentExam.startTime) / 1000);
    const remaining = Math.max(0, this.currentExam.duration - elapsed);

    return remaining;
  }

  setExamResults(results) {
    if (this.currentExam) {
      this.currentExam.results = results;
    }
  }

  resetExamForRetry() {
    if (!this.currentExam) return;
    
    // Reset exam state but keep the questions and configuration
    this.currentExam.startTime = null;
    this.currentExam.endTime = null;
    this.currentExam.currentQuestionIndex = 0;
    this.currentExam.status = 'ready';
    this.currentExam.results = null;
    
    // Reset all question states
    this.currentExam.questions.forEach(question => {
      question.flagged = false;
      question.completed = false;
    });
    
    console.log(`Exam ${this.currentExam.id} reset for retry`);
  }

  resetExam() {
    this.currentExam = null;
    console.log('Exam session reset');
  }
}

// Export singleton instance
module.exports = new ExamService();