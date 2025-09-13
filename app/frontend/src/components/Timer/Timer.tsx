import React, { useState, useEffect } from 'react';

interface TimerProps {
  timeRemaining: number; // in seconds
  onTimeUp: () => void;
}

const Timer: React.FC<TimerProps> = ({ timeRemaining: initialTime, onTimeUp }) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isWarning, setIsWarning] = useState(false);
  const [isCritical, setIsCritical] = useState(false);

  useEffect(() => {
    setTimeLeft(initialTime);
  }, [initialTime]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1;
        
        // Set warning states
        if (newTime <= 300) { // 5 minutes
          setIsCritical(true);
          setIsWarning(false);
        } else if (newTime <= 1800) { // 30 minutes
          setIsWarning(true);
          setIsCritical(false);
        } else {
          setIsWarning(false);
          setIsCritical(false);
        }

        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onTimeUp]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    return (timeLeft / initialTime) * 100;
  };

  const getTimerColor = (): string => {
    if (isCritical) return 'text-red-600';
    if (isWarning) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressColor = (): string => {
    if (isCritical) return 'bg-red-500';
    if (isWarning) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="flex items-center space-x-4">
      {/* Timer Display */}
      <div className={`flex items-center space-x-2 ${getTimerColor()} font-mono text-lg font-bold`}>
        <span>⏰</span>
        <span>{formatTime(timeLeft)}</span>
      </div>

      {/* Progress Bar */}
      <div className="w-32 bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-1000 ${getProgressColor()}`}
          style={{ width: `${getProgressPercentage()}%` }}
        ></div>
      </div>

      {/* Warning Indicators */}
      {isCritical && (
        <div className="flex items-center space-x-1 text-red-600 animate-pulse">
          <span className="text-xs font-medium">⚠️ CRITICAL</span>
        </div>
      )}
      {isWarning && !isCritical && (
        <div className="flex items-center space-x-1 text-yellow-600">
          <span className="text-xs font-medium">⚠️ WARNING</span>
        </div>
      )}

      {/* Time Status */}
      <div className="text-xs text-gray-500">
        {timeLeft > 3600 
          ? `${Math.floor(timeLeft / 3600)}h remaining`
          : timeLeft > 60 
            ? `${Math.floor(timeLeft / 60)}m remaining` 
            : `${timeLeft}s remaining`
        }
      </div>
    </div>
  );
};

export default Timer;