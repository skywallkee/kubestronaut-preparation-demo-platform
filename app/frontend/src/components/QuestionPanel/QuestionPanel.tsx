import React, { useState, useEffect } from 'react';
import { QuestionWithCopyables } from '../../utils/questionParser';
import axios from 'axios';

interface Question {
  id: number;
  title: string;
  description: string;
  points: number;
  flagged: boolean;
  completed: boolean;
  viewed: boolean;
  originalId?: string;
  solution?: {
    steps: string[];
  };
  validations?: Array<{
    command: string;
    expected: string;
    points: number;
    description: string;
  }>;
}

interface QuestionDetails {
  id: string;
  originalId: string;
  title: string;
  description: string;
  points: number;
  category: string;
  timeLimit: number;
  solution: {
    steps: string[];
  };
  validations: Array<{
    command: string;
    expected: string;
    points: number;
    description: string;
  }>;
  tags: string[];
  infrastructure: any;
}

interface QuestionPanelProps {
  questions: Question[];
  currentQuestion: number;
  onNext: () => void;
  onPrevious: () => void;
  onGoToQuestion: (questionIndex: number) => void;
  onComplete: () => void;
  onSubmit: () => void;
  isReviewMode?: boolean;
  onGoHome?: () => void;
  practiceMode?: boolean;
}

const QuestionPanel: React.FC<QuestionPanelProps> = ({
  questions,
  currentQuestion,
  onNext,
  onPrevious,
  onGoToQuestion,
  onComplete,
  onSubmit,
  isReviewMode = false,
  onGoHome,
  practiceMode = false
}) => {
  const current = questions[currentQuestion];
  const totalQuestions = questions.length;
  const completedCount = questions.filter(q => q.completed).length;

  // State for question details in review mode
  const [questionDetails, setQuestionDetails] = useState<QuestionDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [showValidations, setShowValidations] = useState(false);

  // Load question details when in review mode
  useEffect(() => {
    if (isReviewMode && current) {
      loadQuestionDetails();
    }
  }, [isReviewMode, currentQuestion, current]);

  const loadQuestionDetails = async () => {
    if (!current) return;

    setLoadingDetails(true);
    try {
      const questionId = current.originalId || current.id;
      const response = await axios.get(`/api/questions/${questionId}/details`);
      setQuestionDetails(response.data);
    } catch (error) {
      console.error('Error loading question details:', error);
      setQuestionDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  if (!current) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Loading questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Navigation Header */}
      <div className="bg-gray-50 px-6 py-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            {/* Question Selector Dropdown */}
            <div className="flex items-center space-x-2">
              <label htmlFor="question-select" className="text-sm font-medium text-gray-700">
                Question:
              </label>
              <select
                id="question-select"
                value={currentQuestion}
                onChange={(e) => onGoToQuestion(parseInt(e.target.value))}
                className="block w-56 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                {questions.map((question, index) => (
                  <option key={question.id} value={index}>
                    {question.completed ? '✅ ' : ''}
                    {question.viewed && !question.completed ? '👁️ ' : ''}
                    Question {index + 1}: {question.title.substring(0, 35)}{question.title.length > 35 ? '...' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Left/Right Arrow Navigation */}
            <div className="flex items-center space-x-1">
              <button
                onClick={onPrevious}
                disabled={currentQuestion === 0}
                className={`p-2 rounded-md ${
                  currentQuestion === 0
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                } transition-colors`}
                title="Previous Question"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={onNext}
                disabled={currentQuestion === totalQuestions - 1}
                className={`p-2 rounded-md ${
                  currentQuestion === totalQuestions - 1
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                } transition-colors`}
                title="Next Question"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="text-sm text-gray-600">
            {currentQuestion + 1} of {totalQuestions}
          </div>
        </div>
      </div>

      {/* Question Content */}
      <div className="flex-1 px-6 py-6 overflow-y-auto">
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              {current.title}
            </h3>
            <div className="prose max-w-none">
              <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base">
                <QuestionWithCopyables text={current.description} />
              </div>
            </div>

            {/* Question metadata in review mode */}
            {isReviewMode && questionDetails && (
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {questionDetails.category}
                </span>
                <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">
                  {questionDetails.points} points
                </span>
                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                  {questionDetails.timeLimit} min
                </span>
                {questionDetails.tags?.map((tag: string, index: number) => (
                  <span key={index} className="bg-green-100 text-green-800 px-2 py-1 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Practice Mode / Review Mode Additional Content */}
          {(practiceMode || isReviewMode) && (
            <div className="space-y-4">
              {/* Practice Mode: Show inline solution/validations if available */}
              {practiceMode && current.solution && (
                <div className="border rounded-lg">
                  <button
                    onClick={() => setShowSolution(!showSolution)}
                    className="w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 border-b flex items-center justify-between transition-colors"
                  >
                    <h4 className="font-semibold text-blue-900">📋 Solution Steps</h4>
                    <svg
                      className={`w-5 h-5 text-blue-700 transition-transform ${showSolution ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showSolution && (
                    <div className="p-4 bg-white">
                      <ol className="space-y-2">
                        {current.solution.steps.map((step: string, index: number) => (
                          <li key={index} className="flex">
                            <span className="font-semibold text-blue-600 mr-3">{index + 1}.</span>
                            <div className="text-gray-800">
                              <QuestionWithCopyables text={step} />
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}

              {/* Practice Mode: Show inline validations if available */}
              {practiceMode && current.validations && (
                <div className="border rounded-lg">
                  <button
                    onClick={() => setShowValidations(!showValidations)}
                    className="w-full px-4 py-3 bg-green-50 hover:bg-green-100 border-b flex items-center justify-between transition-colors"
                  >
                    <h4 className="font-semibold text-green-900">🔍 Validation Commands</h4>
                    <svg
                      className={`w-5 h-5 text-green-700 transition-transform ${showValidations ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showValidations && (
                    <div className="p-4 bg-white">
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600 mb-4">
                          These are the commands that will be used to validate your solution:
                        </p>
                        {current.validations.map((validation: any, index: number) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-800">
                                {validation.description}
                              </span>
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {validation.points} pts
                              </span>
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm">
                                <span className="font-medium text-gray-700">Command:</span>
                                <code className="ml-2 bg-gray-800 text-green-400 px-2 py-1 rounded text-xs font-mono">
                                  <QuestionWithCopyables text={validation.command} />
                                </code>
                              </div>
                              <div className="text-sm">
                                <span className="font-medium text-gray-700">Expected:</span>
                                <code className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                  {validation.expected}
                                </code>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Review Mode: Load detailed data */}
              {isReviewMode && loadingDetails ? (
                <div className="text-center py-4">
                  <div className="text-gray-500">Loading solution and validation details...</div>
                </div>
              ) : isReviewMode && questionDetails ? (
                <>
                  {/* Solution Section */}
                  <div className="border rounded-lg">
                    <button
                      onClick={() => setShowSolution(!showSolution)}
                      className="w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 border-b flex items-center justify-between transition-colors"
                    >
                      <h4 className="font-semibold text-blue-900">📋 Solution Steps</h4>
                      <svg
                        className={`w-5 h-5 text-blue-700 transition-transform ${showSolution ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showSolution && (
                      <div className="p-4 bg-white">
                        {questionDetails.solution?.steps && questionDetails.solution.steps.length > 0 ? (
                          <ol className="space-y-2">
                            {questionDetails.solution.steps.map((step: string, index: number) => (
                              <li key={index} className="flex">
                                <span className="font-semibold text-blue-600 mr-3">{index + 1}.</span>
                                <div className="text-gray-800">
                                  <QuestionWithCopyables text={step} />
                                </div>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="text-gray-500 italic">No solution steps available for this question.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Validation Commands Section */}
                  <div className="border rounded-lg">
                    <button
                      onClick={() => setShowValidations(!showValidations)}
                      className="w-full px-4 py-3 bg-green-50 hover:bg-green-100 border-b flex items-center justify-between transition-colors"
                    >
                      <h4 className="font-semibold text-green-900">🔍 Validation Commands</h4>
                      <svg
                        className={`w-5 h-5 text-green-700 transition-transform ${showValidations ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showValidations && (
                      <div className="p-4 bg-white">
                        {questionDetails.validations && questionDetails.validations.length > 0 ? (
                          <div className="space-y-4">
                            <p className="text-sm text-gray-600 mb-4">
                              These are the commands that will be used to validate your solution:
                            </p>
                            {questionDetails.validations.map((validation: any, index: number) => (
                              <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-800">
                                    {validation.description}
                                  </span>
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    {validation.points} pts
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <div className="text-sm">
                                    <span className="font-medium text-gray-700">Command:</span>
                                    <code className="ml-2 bg-gray-800 text-green-400 px-2 py-1 rounded text-xs font-mono">
                                      <QuestionWithCopyables text={validation.command} />
                                    </code>
                                  </div>
                                  <div className="text-sm">
                                    <span className="font-medium text-gray-700">Expected:</span>
                                    <code className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                      {validation.expected}
                                    </code>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 italic">No validation commands available for this question.</p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  Unable to load question details. This might be a legacy question format.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="border-t bg-gray-50 px-6 py-4">
        {isReviewMode ? (
          <div className="flex justify-center items-center">
            <button
              onClick={onGoHome}
              className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 font-medium text-lg"
            >
              🏠 Go Home - Start New Exam
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <button
                onClick={() => {
                  onComplete();
                  // Auto-advance to next question if not already on the last one
                  if (!current.completed && currentQuestion < totalQuestions - 1) {
                    setTimeout(() => onNext(), 100); // Small delay for visual feedback
                  }
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  current.completed
                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {current.completed ? '✅ Completed' : 'Mark as Complete'}
              </button>

              <button
                onClick={onSubmit}
                className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 font-medium"
              >
                Submit Exam
              </button>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{Math.round((completedCount / totalQuestions) * 100)}% Complete ({completedCount}/{totalQuestions} questions)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(completedCount / totalQuestions) * 100}%` }}
                ></div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default QuestionPanel;