import React from 'react';

interface Question {
  id: number;
  title: string;
  description: string;
  points: number;
  flagged: boolean;
  completed: boolean;
  viewed: boolean;
}

interface QuestionPanelProps {
  questions: Question[];
  currentQuestion: number;
  onNext: () => void;
  onPrevious: () => void;
  onGoToQuestion: (questionIndex: number) => void;
  onComplete: () => void;
  onSubmit: () => void;
}

const QuestionPanel: React.FC<QuestionPanelProps> = ({
  questions,
  currentQuestion,
  onNext,
  onPrevious,
  onGoToQuestion,
  onComplete,
  onSubmit
}) => {
  const current = questions[currentQuestion];
  const totalQuestions = questions.length;
  const completedCount = questions.filter(q => q.completed).length;

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
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              {current.title}
            </h3>
            <div className="prose max-w-none">
              <div
                className="text-gray-700 leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: current.description }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* Action Buttons */}
      <div className="border-t bg-gray-50 px-6 py-4">
        <div className="flex justify-between items-center">
          <button
            onClick={onComplete}
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
      </div>
    </div>
  );
};

export default QuestionPanel;