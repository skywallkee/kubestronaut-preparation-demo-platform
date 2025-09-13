import React, { useState, useEffect } from 'react';
import QuestionPanel from '../QuestionPanel/QuestionPanel';
import Terminal from '../Terminal/Terminal';
import Timer from '../Timer/Timer';
import axios from 'axios';

interface Question {
  id: number;
  title: string;
  description: string;
  points: number;
  flagged: boolean;
  completed: boolean;
}

interface ExamState {
  currentQuestion: number;
  questions: Question[];
  timeRemaining: number;
  examStarted: boolean;
  examCompleted: boolean;
}

const ExamInterface: React.FC = () => {
  const [examState, setExamState] = useState<ExamState>({
    currentQuestion: 0,
    questions: [],
    timeRemaining: 7200, // 2 hours in seconds
    examStarted: false,
    examCompleted: false
  });

  const [showResults, setShowResults] = useState(false);
  const [examResults, setExamResults] = useState<any>(null);

  useEffect(() => {
    // Load exam data when component mounts
    loadExamData();
  }, []);

  const loadExamData = async () => {
    try {
      const response = await axios.get('/api/exams/current');
      if (response.data) {
        setExamState(prev => ({
          ...prev,
          questions: response.data.questions || [],
          timeRemaining: response.data.duration || 7200
        }));
      }
    } catch (error) {
      console.error('Error loading exam data:', error);
    }
  };

  const startExam = async () => {
    try {
      await axios.post('/api/exams/start');
      setExamState(prev => ({ ...prev, examStarted: true }));
    } catch (error) {
      console.error('Error starting exam:', error);
      alert('Failed to start exam. Please ensure the Helm chart is applied to your cluster.');
    }
  };

  const nextQuestion = async () => {
    if (examState.currentQuestion < examState.questions.length - 1) {
      try {
        await axios.post('/api/questions/next');
        setExamState(prev => ({
          ...prev,
          currentQuestion: prev.currentQuestion + 1
        }));
      } catch (error) {
        console.error('Error moving to next question:', error);
      }
    } else {
      // All questions answered, move to flagged questions or finish
      const flaggedQuestions = examState.questions.filter(q => q.flagged && !q.completed);
      if (flaggedQuestions.length > 0) {
        const firstFlagged = examState.questions.findIndex(q => q.flagged && !q.completed);
        setExamState(prev => ({
          ...prev,
          currentQuestion: firstFlagged
        }));
      }
    }
  };

  const flagQuestion = async () => {
    try {
      await axios.post('/api/exams/flag');
      setExamState(prev => ({
        ...prev,
        questions: prev.questions.map((q, index) =>
          index === prev.currentQuestion ? { ...q, flagged: !q.flagged } : q
        )
      }));
    } catch (error) {
      console.error('Error flagging question:', error);
    }
  };

  const completeQuestion = async () => {
    try {
      await axios.post('/api/exams/complete');
      setExamState(prev => ({
        ...prev,
        questions: prev.questions.map((q, index) =>
          index === prev.currentQuestion ? { ...q, completed: true, flagged: false } : q
        )
      }));
    } catch (error) {
      console.error('Error completing question:', error);
    }
  };

  const submitExam = async () => {
    if (window.confirm('Are you sure you want to submit the exam? This action cannot be undone.')) {
      try {
        const response = await axios.post('/api/exams/submit');
        setExamState(prev => ({ ...prev, examCompleted: true }));
        setExamResults(response.data);
        setShowResults(true);
      } catch (error) {
        console.error('Error submitting exam:', error);
        alert('Failed to submit exam. Please try again.');
      }
    }
  };

  const handleTimeUp = () => {
    submitExam();
  };

  if (showResults && examResults) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white shadow rounded-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Exam Results</h1>
            
            <div className="mb-6">
              <div className={`p-4 rounded-lg ${examResults.score >= 67 ? 'bg-green-50' : 'bg-red-50'}`}>
                <h2 className={`text-xl font-semibold ${examResults.score >= 67 ? 'text-green-800' : 'text-red-800'}`}>
                  Score: {examResults.score}/100
                </h2>
                <p className={`${examResults.score >= 67 ? 'text-green-700' : 'text-red-700'}`}>
                  {examResults.score >= 67 ? 'PASSED' : 'FAILED'} (Passing score: 67/100)
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Detailed Feedback</h3>
              {examResults.feedback && examResults.feedback.map((item: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <h4 className="font-medium text-gray-900">Question {index + 1}: {item.title}</h4>
                  <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                  <div className="flex items-center space-x-4">
                    <span className={`px-2 py-1 rounded text-xs ${item.correct ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {item.correct ? 'Correct' : 'Incorrect'}
                    </span>
                    <span className="text-sm text-gray-500">Points: {item.points}/{item.maxPoints}</span>
                  </div>
                  {item.explanation && (
                    <div className="mt-2 p-3 bg-blue-50 rounded">
                      <p className="text-sm text-blue-800">{item.explanation}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex space-x-4">
              <button
                onClick={() => window.location.href = '/'}
                className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
                Take Another Exam
              </button>
              <button
                onClick={() => setShowResults(false)}
                className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
              >
                Review Questions
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!examState.examStarted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white shadow rounded-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Ready to Start?</h1>
          <p className="text-gray-600 mb-6">
            Make sure you have applied the Helm chart to your Kubernetes cluster before starting the exam.
          </p>
          <button
            onClick={startExam}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700"
          >
            Start Exam
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header with Timer */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">
            Kubernetes Certification Exam
          </h1>
          <Timer
            timeRemaining={examState.timeRemaining}
            onTimeUp={handleTimeUp}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Question Panel */}
        <div className="w-1/2 border-r bg-white">
          <QuestionPanel
            questions={examState.questions}
            currentQuestion={examState.currentQuestion}
            onNext={nextQuestion}
            onFlag={flagQuestion}
            onComplete={completeQuestion}
            onSubmit={submitExam}
          />
        </div>

        {/* Terminal Panel */}
        <div className="w-1/2 bg-black">
          <Terminal />
        </div>
      </div>
    </div>
  );
};

export default ExamInterface;