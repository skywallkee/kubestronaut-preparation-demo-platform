import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Type definitions
interface ExamOptions {
  examTypes: string[];
  difficultyLevels: Record<string, string[]>;
  questionCounts: Record<string, Record<string, number>>;
}

interface ExamType {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface DifficultyLevel {
  id: string;
  name: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

interface HelmState {
  chartReady: boolean;
  applied: boolean;
  downloaded: boolean;
  applyError: string;
  streamingLogs: string[];
}

// UI Configuration - Can be moved to a config file later
const EXAM_TYPES: ExamType[] = [
  {
    id: 'ckad',
    name: 'CKAD',
    description: 'Certified Kubernetes Application Developer',
    icon: '🔧'
  },
  {
    id: 'cka',
    name: 'CKA',
    description: 'Certified Kubernetes Administrator',
    icon: '⚙️'
  },
  {
    id: 'cks',
    name: 'CKS',
    description: 'Certified Kubernetes Security Specialist',
    icon: '🔒'
  },
  {
    id: 'kcna',
    name: 'KCNA',
    description: 'Kubernetes and Cloud Native Associate',
    icon: '☁️'
  }
];

const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  {
    id: 'beginner',
    name: 'Beginner',
    description: 'Basic Kubernetes concepts',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  {
    id: 'intermediate',
    name: 'Intermediate',
    description: 'Advanced scenarios',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200'
  },
  {
    id: 'advanced',
    name: 'Advanced',
    description: 'Complex challenges',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  }
];

/**
 * Normalizes API data to lowercase for consistent comparison
 * Prevents issues where API returns "CKAD" but UI uses "ckad"
 */
const normalizeApiData = (data: any): ExamOptions => {
  const examTypes = Array.isArray(data?.examTypes)
    ? data.examTypes.map((t: string) => t.toLowerCase())
    : [];

  const difficultyLevels = data?.difficultyLevels && typeof data.difficultyLevels === 'object'
    ? Object.entries(data.difficultyLevels).reduce((acc, [exam, levels]) => {
        acc[exam.toLowerCase()] = Array.isArray(levels)
          ? levels.map((l: any) => String(l).toLowerCase())
          : [];
        return acc;
      }, {} as Record<string, string[]>)
    : {};

  const questionCounts = data?.questionCounts && typeof data.questionCounts === 'object'
    ? Object.entries(data.questionCounts).reduce((acc, [exam, counts]) => {
        acc[exam.toLowerCase()] = counts && typeof counts === 'object'
          ? Object.entries(counts).reduce((diffAcc, [diff, count]) => {
              diffAcc[diff.toLowerCase()] = typeof count === 'number' ? count : 0;
              return diffAcc;
            }, {} as Record<string, number>)
          : {};
        return acc;
      }, {} as Record<string, Record<string, number>>)
    : {};

  return { examTypes, difficultyLevels, questionCounts };
};

const ExamSelection: React.FC = () => {
  const navigate = useNavigate();

  // API state
  const [availableOptions, setAvailableOptions] = useState<ExamOptions>({
    examTypes: [],
    difficultyLevels: {},
    questionCounts: {}
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState('');

  // Selection state
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [practiceMode, setPracticeMode] = useState(false);

  // Helm state - Using single state object to reduce re-renders
  const [helmState, setHelmState] = useState<HelmState>({
    chartReady: false,
    applied: false,
    downloaded: false,
    applyError: '',
    streamingLogs: []
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  /**
   * Reset Helm state - memoized to prevent recreating on every render
   */
  const resetHelmState = useCallback(() => {
    setHelmState({
      chartReady: false,
      applied: false,
      downloaded: false,
      applyError: '',
      streamingLogs: []
    });
  }, []);

  /**
   * Check if an exam has any questions across all difficulties
   */
  const getExamTotalQuestions = useCallback((examId: string): number => {
    const examQuestionCounts = availableOptions.questionCounts[examId] ?? {};
    return Object.values(examQuestionCounts)
      .filter((c): c is number => typeof c === 'number')
      .reduce((sum, count) => sum + count, 0);
  }, [availableOptions.questionCounts]);

  /**
   * Check if a specific difficulty has questions for the selected exam
   */
  const getDifficultyQuestionCount = useCallback((examId: string, difficultyId: string): number => {
    return availableOptions.questionCounts[examId]?.[difficultyId] ?? 0;
  }, [availableOptions.questionCounts]);

  // Fetch available options from API
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setIsLoading(true);
        setLoadingError('');

        const response = await axios.get<any>('/api/exams/options');
        const normalizedData = normalizeApiData(response.data);
        setAvailableOptions(normalizedData);
      } catch (error) {
        console.error('Failed to load exam options:', error);
        setAvailableOptions({ examTypes: [], difficultyLevels: {}, questionCounts: {} });
        setLoadingError('Failed to load exam options. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOptions();
  }, []);

  /**
   * Validate and reset selections when they become invalid
   * Only resets if the exam truly has no questions (not during loading)
   */
  useEffect(() => {
    if (!selectedExam || isLoading) return;

    const totalQuestions = getExamTotalQuestions(selectedExam);

    // Only reset if we have loaded data and exam has no questions
    if (!isLoading && totalQuestions === 0) {
      setSelectedExam('');
      setSelectedDifficulty('');
      resetHelmState();
    }
  }, [selectedExam, isLoading, getExamTotalQuestions, resetHelmState]);

  /**
   * Reset difficulty if it becomes invalid for the selected exam
   */
  useEffect(() => {
    if (!selectedExam || !selectedDifficulty || isLoading) return;

    const difficultyCount = getDifficultyQuestionCount(selectedExam, selectedDifficulty);

    // Only reset if difficulty has no questions
    if (!isLoading && difficultyCount === 0) {
      setSelectedDifficulty('');
      resetHelmState();
    }
  }, [selectedExam, selectedDifficulty, isLoading, getDifficultyQuestionCount, resetHelmState]);

  /**
   * Computed values for button states - memoized for performance
   */
  const canGenerateHelm = useMemo(() =>
    selectedExam && selectedDifficulty && !helmState.chartReady,
    [selectedExam, selectedDifficulty, helmState.chartReady]
  );

  const canDownloadHelm = useMemo(() =>
    helmState.chartReady && !helmState.downloaded,
    [helmState.chartReady, helmState.downloaded]
  );

  const canApplyHelm = useMemo(() =>
    helmState.chartReady && !helmState.applied,
    [helmState.chartReady, helmState.applied]
  );

  const canStartExam = useMemo(() =>
    helmState.applied && selectedExam && selectedDifficulty,
    [helmState.applied, selectedExam, selectedDifficulty]
  );

  /**
   * Handle exam card selection
   */
  const handleExamSelect = useCallback((examId: string, enabled: boolean) => {
    if (!enabled) return;

    setSelectedExam(examId);
    setSelectedDifficulty(''); // Reset difficulty when exam changes
    resetHelmState();
  }, [resetHelmState]);

  /**
   * Handle difficulty card selection
   */
  const handleDifficultySelect = useCallback((difficultyId: string, enabled: boolean) => {
    if (!enabled) return;

    setSelectedDifficulty(difficultyId);
    resetHelmState();
  }, [resetHelmState]);

  /**
   * Generate Helm chart for selected exam/difficulty
   */
  const generateHelmChart = useCallback(async () => {
    if (!canGenerateHelm) return;

    try {
      setIsGenerating(true);
      const response = await axios.post('/api/helm/generate', {
        examType: selectedExam,
        difficulty: selectedDifficulty
      });

      if (response.data.success) {
        setHelmState(prev => ({ ...prev, chartReady: true, applyError: '' }));
      }
    } catch (error) {
      console.error('Error generating Helm chart:', error);
      setHelmState(prev => ({
        ...prev,
        applyError: 'Failed to generate Helm chart. Please try again.'
      }));
    } finally {
      setIsGenerating(false);
    }
  }, [canGenerateHelm, selectedExam, selectedDifficulty]);

  /**
   * Download generated Helm chart
   */
  const downloadHelmChart = useCallback(async () => {
    if (!canDownloadHelm) return;

    try {
      const response = await axios.get('/api/helm/download', {
        responseType: 'blob',
        params: {
          examType: selectedExam,
          difficulty: selectedDifficulty
        }
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedExam}-${selectedDifficulty}-helm-chart.tar.gz`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setHelmState(prev => ({ ...prev, downloaded: true }));
    } catch (error) {
      console.error('Error downloading Helm chart:', error);
      setHelmState(prev => ({
        ...prev,
        applyError: 'Failed to download Helm chart.'
      }));
    }
  }, [canDownloadHelm, selectedExam, selectedDifficulty]);

  /**
   * Apply Helm chart to cluster with streaming logs
   */
  const applyToCluster = useCallback(() => {
    if (!canApplyHelm) return;

    setIsApplying(true);
    setHelmState(prev => ({
      ...prev,
      applyError: '',
      streamingLogs: ['🔗 Connecting to cluster...']
    }));

    const eventSource = new EventSource(
      `/api/helm/apply?examType=${selectedExam}&difficulty=${selectedDifficulty}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setHelmState(prev => ({
          ...prev,
          streamingLogs: [...prev.streamingLogs, data.message]
        }));
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    eventSource.addEventListener('complete', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        if (data.success) {
          setHelmState(prev => ({
            ...prev,
            applied: true,
            streamingLogs: [...prev.streamingLogs, '🎉 Deployment completed successfully!']
          }));
        } else {
          setHelmState(prev => ({
            ...prev,
            applyError: data.error || 'Failed to apply Helm chart',
            streamingLogs: [...prev.streamingLogs, `❌ Error: ${data.error || 'Unknown error'}`]
          }));
        }
      } catch (error) {
        console.error('Error parsing completion:', error);
      }
      setIsApplying(false);
      eventSource.close();
    });

    eventSource.onerror = () => {
      setHelmState(prev => ({
        ...prev,
        applyError: 'Connection lost. Please try again.',
        streamingLogs: [...prev.streamingLogs, '❌ Connection error']
      }));
      setIsApplying(false);
      eventSource.close();
    };
  }, [canApplyHelm, selectedExam, selectedDifficulty]);

  /**
   * Start exam and navigate to exam interface
   */
  const startExam = useCallback(async () => {
    if (!canStartExam) return;

    try {
      await axios.post('/api/exam/start', {
        examType: selectedExam,
        difficulty: selectedDifficulty,
        practiceMode: practiceMode
      });

      navigate('/exam');
    } catch (error) {
      console.error('Error starting exam:', error);
      setHelmState(prev => ({
        ...prev,
        applyError: 'Failed to start exam. Please ensure the environment is ready.'
      }));
    }
  }, [canStartExam, selectedExam, selectedDifficulty, practiceMode, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            🚀 Kubestronaut Preparation Platform
          </h1>
          <p className="text-xl text-gray-600">
            Select your certification exam and start practicing
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500"></div>
            <p className="mt-4 text-gray-600">Loading exam options...</p>
          </div>
        )}

        {/* Error State */}
        {loadingError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg mb-8">
            <p className="font-semibold">⚠️ {loadingError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm underline hover:text-red-900"
            >
              Click here to retry
            </button>
          </div>
        )}

        {/* Main Content */}
        {!isLoading && !loadingError && (
          <>
            {/* Exam Type Selection */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-700">
                1. Choose Your Certification
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {EXAM_TYPES.map((exam) => {
                  // Check if exam has any questions
                  const totalQuestions = getExamTotalQuestions(exam.id);
                  const enabled = totalQuestions > 0;
                  const selected = selectedExam === exam.id;

                  return (
                    <div
                      key={exam.id}
                      onClick={() => handleExamSelect(exam.id, enabled)}
                      className={`
                        relative p-6 rounded-xl transition-all duration-200
                        ${enabled ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-50'}
                        ${selected
                          ? 'bg-blue-500 text-white shadow-2xl ring-4 ring-blue-300'
                          : 'bg-white hover:shadow-xl'
                        }
                      `}
                      aria-disabled={!enabled}
                      role="button"
                      tabIndex={enabled ? 0 : -1}
                    >
                      <div className="text-4xl mb-3">{exam.icon}</div>
                      <h3 className={`text-2xl font-bold mb-2 ${selected ? 'text-white' : 'text-gray-800'}`}>
                        {exam.name}
                      </h3>
                      <p className={`text-sm mb-2 ${selected ? 'text-blue-100' : 'text-gray-600'}`}>
                        {exam.description}
                      </p>
                      {enabled && (
                        <div className={`text-xs font-medium ${selected ? 'text-blue-100' : 'text-gray-500'}`}>
                          {totalQuestions} questions available
                        </div>
                      )}
                      {!enabled && (
                        <div className="text-xs text-red-500 font-medium">
                          No questions available
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Difficulty Selection */}
            {selectedExam && (
              <div className="mb-8 animate-fade-in">
                <h2 className="text-2xl font-semibold mb-4 text-gray-700">
                  2. Select Difficulty Level
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {DIFFICULTY_LEVELS.map((level) => {
                    // Check if this difficulty has questions for selected exam
                    const questionCount = getDifficultyQuestionCount(selectedExam, level.id);
                    const enabled = questionCount > 0;
                    const selected = selectedDifficulty === level.id;

                    return (
                      <div
                        key={level.id}
                        onClick={() => handleDifficultySelect(level.id, enabled)}
                        className={`
                          relative p-6 rounded-xl transition-all duration-200
                          ${enabled ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-50'}
                          ${selected
                            ? `${level.bgColor} ${level.borderColor} border-2 shadow-lg ring-4 ring-opacity-50`
                            : 'bg-white hover:shadow-lg'
                          }
                        `}
                        aria-disabled={!enabled}
                        role="button"
                        tabIndex={enabled ? 0 : -1}
                      >
                        <h3 className={`text-xl font-bold mb-2 ${selected ? level.color : 'text-gray-800'}`}>
                          {level.name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                          {level.description}
                        </p>
                        {enabled && (
                          <div className="text-xs text-gray-500">
                            {questionCount} questions
                          </div>
                        )}
                        {!enabled && (
                          <div className="text-xs text-red-500">
                            Not available for {EXAM_TYPES.find(e => e.id === selectedExam)?.name}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Practice Mode Toggle */}
            {selectedDifficulty && (
              <div className="mb-8 animate-fade-in">
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={practiceMode}
                      onChange={(e) => setPracticeMode(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
                      practiceMode ? 'bg-blue-500' : 'bg-gray-300'
                    }`}>
                      <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                        practiceMode ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </div>
                    <span className="ml-3 text-lg font-medium text-gray-700">
                      Practice Mode
                    </span>
                    <span className="ml-2 text-sm text-gray-500">
                      (Get immediate feedback on answers)
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Helm Chart Actions */}
            {selectedDifficulty && (
              <div className="mb-8 animate-fade-in">
                <h2 className="text-2xl font-semibold mb-4 text-gray-700">
                  3. Prepare Exam Environment
                </h2>
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <div className="flex flex-wrap gap-4 mb-6">
                    <button
                      onClick={generateHelmChart}
                      disabled={!canGenerateHelm || isGenerating}
                      className={`
                        px-6 py-3 rounded-lg font-medium transition-all
                        ${canGenerateHelm && !isGenerating
                          ? 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }
                      `}
                    >
                      {isGenerating ? (
                        <>
                          <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                          Generating...
                        </>
                      ) : (
                        <>
                          {helmState.chartReady ? '✅' : '📦'} Generate Helm Chart
                        </>
                      )}
                    </button>

                    <button
                      onClick={downloadHelmChart}
                      disabled={!canDownloadHelm}
                      className={`
                        px-6 py-3 rounded-lg font-medium transition-all
                        ${canDownloadHelm
                          ? 'bg-green-500 text-white hover:bg-green-600 hover:shadow-lg'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }
                      `}
                    >
                      {helmState.downloaded ? '✅' : '💾'} Download Chart
                    </button>

                    <button
                      onClick={applyToCluster}
                      disabled={!canApplyHelm || isApplying}
                      className={`
                        px-6 py-3 rounded-lg font-medium transition-all
                        ${canApplyHelm && !isApplying
                          ? 'bg-purple-500 text-white hover:bg-purple-600 hover:shadow-lg'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }
                      `}
                    >
                      {isApplying ? (
                        <>
                          <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                          Applying...
                        </>
                      ) : (
                        <>
                          {helmState.applied ? '✅' : '🚀'} Apply to Cluster
                        </>
                      )}
                    </button>
                  </div>

                  {/* Streaming Logs */}
                  {helmState.streamingLogs.length > 0 && (
                    <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
                      {helmState.streamingLogs.map((log, index) => (
                        <div key={index} className="mb-1">
                          {log}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Helm Error */}
                  {helmState.applyError && (
                    <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                      {helmState.applyError}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Start Exam Button */}
            {helmState.applied && (
              <div className="text-center animate-fade-in">
                <button
                  onClick={startExam}
                  disabled={!canStartExam}
                  className={`
                    px-12 py-4 rounded-lg font-bold text-xl transition-all transform
                    ${canStartExam
                      ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 hover:scale-105 hover:shadow-xl'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  🎯 Start Exam
                </button>
                <div className="mt-4 text-gray-600">
                  <p className="font-medium">
                    {EXAM_TYPES.find(e => e.id === selectedExam)?.name} - {' '}
                    {DIFFICULTY_LEVELS.find(l => l.id === selectedDifficulty)?.name}
                  </p>
                  <p className="text-sm mt-1">
                    {getDifficultyQuestionCount(selectedExam, selectedDifficulty)} questions
                    {practiceMode && ' • Practice Mode Enabled'}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add fade-in animation */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ExamSelection;