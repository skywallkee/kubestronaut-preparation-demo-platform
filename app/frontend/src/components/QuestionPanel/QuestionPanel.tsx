import React from 'react';

interface Question {
  id: number;
  title: string;
  description: string;
  points: number;
  flagged: boolean;
  completed: boolean;
}

interface QuestionPanelProps {
  questions: Question[];
  currentQuestion: number;
  onNext: () => void;
  onFlag: () => void;
  onComplete: () => void;
  onSubmit: () => void;
}

const QuestionPanel: React.FC<QuestionPanelProps> = ({
  questions,
  currentQuestion,
  onNext,
  onFlag,
  onComplete,
  onSubmit
}) => {
  const current = questions[currentQuestion];
  const totalQuestions = questions.length;
  const completedCount = questions.filter(q => q.completed).length;
  const flaggedCount = questions.filter(q => q.flagged).length;

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
      {/* Question Header */}
      <div className="bg-gray-50 px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Question {currentQuestion + 1} of {totalQuestions}
          </h2>
          <div className="flex items-center space-x-4 text-sm">
            <span className="text-green-600">
              Completed: {completedCount}/{totalQuestions}
            </span>
            <span className="text-yellow-600">
              Flagged: {flaggedCount}
            </span>
            <span className="font-medium text-blue-600">
              Points: {current.points}
            </span>
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

          {/* Question Status Indicators */}
          <div className="flex items-center space-x-2">
            {current.flagged && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                🚩 Flagged
              </span>
            )}
            {current.completed && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✅ Completed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="border-t bg-gray-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex space-x-3">
            <button
              onClick={onFlag}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                current.flagged
                  ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {current.flagged ? 'Unflag' : 'Flag for Later'}
            </button>
            <button
              onClick={onComplete}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                current.completed
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              {current.completed ? 'Completed ✓' : 'Mark Complete'}
            </button>
          </div>

          <div className="flex space-x-3">
            {currentQuestion === totalQuestions - 1 && flaggedCount === 0 ? (
              <button
                onClick={onSubmit}
                className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 font-medium"
              >
                Submit Exam
              </button>
            ) : (
              <button
                onClick={onNext}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium"
              >
                {currentQuestion === totalQuestions - 1 ? 'Review Flagged' : 'Next Question'}
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{Math.round((completedCount / totalQuestions) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedCount / totalQuestions) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionPanel;