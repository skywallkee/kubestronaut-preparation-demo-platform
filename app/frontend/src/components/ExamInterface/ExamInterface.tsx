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
  viewed: boolean;
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

  // Panel resizing state
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);

  // Tab state for Questions/Documentation
  const [activeTab, setActiveTab] = useState<'questions' | 'documentation'>('questions');

  useEffect(() => {
    // Load exam data when component mounts
    loadExamData();
  }, []);

  // Panel resizing handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const container = document.querySelector('.main-content-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100;

    // Constrain between 30% and 60%
    const constrainedWidth = Math.min(60, Math.max(30, newLeftWidth));
    setLeftPanelWidth(constrainedWidth);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const loadExamData = async () => {
    try {
      const response = await axios.get('/api/exams/current');
      if (response.data) {
        const questions = response.data.questions || [];
        // Mark the first question as viewed
        if (questions.length > 0) {
          questions[0].viewed = true;
        }

        setExamState(prev => ({
          ...prev,
          questions,
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
        const nextIndex = examState.currentQuestion + 1;

        // Update state immediately and mark as viewed
        setExamState(prev => ({
          ...prev,
          currentQuestion: nextIndex,
          questions: prev.questions.map((q, index) =>
            index === nextIndex
              ? { ...q, viewed: true }
              : q
          )
        }));

        await axios.post('/api/questions/next');
      } catch (error) {
        console.error('Error moving to next question:', error);
      }
    }
  };

  const previousQuestion = async () => {
    if (examState.currentQuestion > 0) {
      const prevIndex = examState.currentQuestion - 1;

      // Update state immediately and mark as viewed
      setExamState(prev => ({
        ...prev,
        currentQuestion: prevIndex,
        questions: prev.questions.map((q, index) =>
          index === prevIndex
            ? { ...q, viewed: true }
            : q
        )
      }));
    }
  };

  const goToQuestion = async (questionIndex: number) => {
    if (questionIndex >= 0 && questionIndex < examState.questions.length) {
      try {
        // Update state immediately for responsive UI - mark as viewed right away
        setExamState(prev => ({
          ...prev,
          currentQuestion: questionIndex,
          questions: prev.questions.map((q, index) =>
            index === questionIndex
              ? { ...q, viewed: true }
              : q
          )
        }));

        // Then sync with backend
        const response = await axios.post('/api/questions/goto', { questionIndex });
        if (response.data && response.data.question) {
          setExamState(prev => ({
            ...prev,
            currentQuestion: questionIndex,
            questions: prev.questions.map((q, index) =>
              index === questionIndex
                ? {
                    ...q,
                    viewed: true, // Ensure this is always true when navigating
                    flagged: response.data.question.flagged,
                    completed: response.data.question.completed
                  }
                : q
            )
          }));
        }
      } catch (error) {
        console.error('Error navigating to question:', error);
        // Keep the viewed state even on error
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
    <div className={`h-screen flex flex-col bg-gray-50 ${isDragging ? 'select-none' : ''}`}>
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
      <div className="flex-1 flex overflow-hidden main-content-container">
        {/* Question Panel */}
        <div
          className="bg-white border-r flex flex-col"
          style={{ width: `${leftPanelWidth}%` }}
        >
          {/* Tab Selector */}
          <div className="flex border-b bg-gray-50">
            <button
              onClick={() => setActiveTab('questions')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'questions'
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Questions
            </button>
            <button
              onClick={() => setActiveTab('documentation')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'documentation'
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Documentation
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'questions' ? (
              <QuestionPanel
                questions={examState.questions}
                currentQuestion={examState.currentQuestion}
                onNext={nextQuestion}
                onPrevious={previousQuestion}
                onGoToQuestion={goToQuestion}
                onComplete={completeQuestion}
                onSubmit={submitExam}
              />
            ) : (
              <div className="h-full flex flex-col">
                <div className="p-4 bg-blue-50 border-b border-blue-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 text-sm text-blue-800 mb-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span>
                          <strong>Documentation:</strong> For Google search redirect URLs, paste them below to navigate within frame.
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="url"
                          placeholder="Paste Google CSE redirect URL here..."
                          className="flex-1 text-xs px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              const input = e.target as HTMLInputElement;
                              const url = input.value.trim();

                              // Extract the actual URL from Google CSE redirect
                              const extractRealUrl = (googleUrl: string): string => {
                                try {
                                  const urlObj = new URL(googleUrl);
                                  const qParam = urlObj.searchParams.get('q');
                                  if (qParam && qParam.startsWith('http')) {
                                    return qParam;
                                  }
                                } catch (e) {
                                  const match = googleUrl.match(/q=(https?:\/\/[^&]+)/);
                                  if (match) {
                                    return decodeURIComponent(match[1]);
                                  }
                                }
                                return googleUrl;
                              };

                              const realUrl = extractRealUrl(url);

                              if (realUrl.includes('kubernetes.io')) {
                                const iframe = document.querySelector('iframe[title="Kubernetes Documentation"]') as HTMLIFrameElement;
                                if (iframe) {
                                  iframe.src = realUrl;
                                  input.value = '';
                                }
                              } else if (url.includes('kubernetes.io')) {
                                // Direct kubernetes.io URL
                                const iframe = document.querySelector('iframe[title="Kubernetes Documentation"]') as HTMLIFrameElement;
                                if (iframe) {
                                  iframe.src = url;
                                  input.value = '';
                                }
                              } else {
                                alert('Please enter a valid kubernetes.io URL or Google CSE redirect URL');
                              }
                            }
                          }}
                        />
                        <span className="text-xs text-blue-600">Press Enter</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const iframe = document.querySelector('iframe[title="Kubernetes Documentation"]') as HTMLIFrameElement;
                        if (iframe) {
                          iframe.src = iframe.src; // Refresh iframe
                        }
                      }}
                      className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded transition-colors"
                      title="Refresh Documentation"
                    >
                      ↻ Refresh
                    </button>
                  </div>
                </div>
                <iframe
                  name="k8s-docs"
                  src="https://kubernetes.io/docs/"
                  className="w-full flex-1 border-0"
                  title="Kubernetes Documentation"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-navigation"
                  referrerPolicy="no-referrer-when-downgrade"
                  style={{
                    background: 'white'
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Resize Handle */}
        <div
          className={`w-1 bg-gray-300 hover:bg-gray-400 cursor-col-resize flex-shrink-0 ${isDragging ? 'bg-gray-400' : ''}`}
          onMouseDown={handleMouseDown}
          title="Drag to resize panels"
        >
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-0.5 h-8 bg-gray-500 rounded-full"></div>
          </div>
        </div>

        {/* Terminal Panel */}
        <div
          className="bg-black"
          style={{ width: `${100 - leftPanelWidth}%` }}
        >
          <Terminal />
        </div>
      </div>
    </div>
  );
};

export default ExamInterface;