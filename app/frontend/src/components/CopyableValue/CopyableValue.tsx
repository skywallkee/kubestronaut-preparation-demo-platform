import React, { useState } from 'react';

interface CopyableValueProps {
  value: string;
  className?: string;
}

const CopyableValue: React.FC<CopyableValueProps> = ({ value, className = '' }) => {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Strip surrounding quotes if present
  const stripQuotes = (str: string): string => {
    // Check if string is wrapped in single or double quotes
    if ((str.startsWith("'") && str.endsWith("'")) ||
        (str.startsWith('"') && str.endsWith('"'))) {
      return str.slice(1, -1);
    }
    return str;
  };

  // Display value with quotes, but copy without them
  const displayValue = value;
  const copyValue = stripQuotes(value);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      setShowTooltip(true);
      setTimeout(() => {
        setCopied(false);
        setShowTooltip(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <span className="relative inline-block">
      <button
        onClick={handleCopy}
        onMouseEnter={() => !copied && setShowTooltip(true)}
        onMouseLeave={() => !copied && setShowTooltip(false)}
        className={`
          inline-flex items-center px-2 py-0.5 mx-0.5
          bg-blue-50 hover:bg-blue-100
          text-blue-700 hover:text-blue-800
          border border-blue-300 hover:border-blue-400
          rounded-full text-sm font-mono
          cursor-pointer transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
          ${copied ? 'bg-green-100 border-green-400 text-green-700' : ''}
          ${className}
        `}
        type="button"
      >
        {displayValue}
        <svg
          className={`ml-1 w-3.5 h-3.5 ${copied ? 'text-green-600' : 'text-blue-500'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          {copied ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          )}
        </svg>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-10">
          <div className="bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
            {copied ? 'Copied!' : 'Click to copy'}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
          </div>
        </div>
      )}
    </span>
  );
};

export default CopyableValue;