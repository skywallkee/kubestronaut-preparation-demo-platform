import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface ExamConfig {
  type: string;
  difficulty: string;
  practiceMode?: boolean;
}

interface ExamOptions {
  examTypes: string[];
  difficultyLevels: Record<string, string[]>;
  questionCounts: Record<string, Record<string, number>>;
}

const ExamSelection: React.FC = () => {
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
  const [practiceMode, setPracticeMode] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [helmChartReady, setHelmChartReady] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [helmApplied, setHelmApplied] = useState<boolean>(false);
  const [helmDownloaded, setHelmDownloaded] = useState<boolean>(false);
  const [applyError, setApplyError] = useState<string>('');
  const [streamingLogs, setStreamingLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState<boolean>(false);

  const [availableOptions, setAvailableOptions] = useState<ExamOptions>({
    examTypes: [],
    difficultyLevels: {},
    questionCounts: {}
  });


  const examTypes = [
    { id: 'ckad', name: 'CKAD', description: 'Certified Kubernetes Application Developer' },
    { id: 'cka', name: 'CKA', description: 'Certified Kubernetes Administrator' },
    { id: 'cks', name: 'CKS', description: 'Certified Kubernetes Security Specialist' },
    { id: 'kcna', name: 'KCNA', description: 'Kubernetes and Cloud Native Associate' }
  ];

  const difficultyLevels = [
    { id: 'beginner', name: 'Beginner', description: 'Basic concepts and simple tasks' },
    { id: 'intermediate', name: 'Intermediate', description: 'Standard certification level' },
    { id: 'advanced', name: 'Advanced', description: 'Complex scenarios and edge cases' }
  ];

  useEffect(() => {
  axios.get<ExamOptions>('/api/exams/options')
      .then((res) => {
        const data = res.data as Partial<ExamOptions> | undefined;
        const examTypes = Array.isArray(data?.examTypes) ? data?.examTypes ?? [] : [];
        const difficultyLevels = (data && typeof data.difficultyLevels === 'object' && data.difficultyLevels !== null)
          ? data.difficultyLevels as Record<string, string[]>
          : {};
        const questionCounts = (data && typeof data.questionCounts === 'object' && data.questionCounts !== null)
          ? data.questionCounts as Record<string, Record<string, number>>
          : {};

        setAvailableOptions({ examTypes, difficultyLevels, questionCounts });
      })
      .catch(() => {
        setAvailableOptions({ examTypes: [], difficultyLevels: {}, questionCounts: {} });
      });
  }, []);

  useEffect(() => {
    if (selectedExam && !availableOptions.examTypes.includes(selectedExam)) {
      setSelectedExam('');
      setSelectedDifficulty('');
    }
  }, [availableOptions.examTypes, selectedExam]);

  useEffect(() => {
    if (selectedExam && selectedDifficulty) {
      const difficulties = availableOptions.difficultyLevels[selectedExam] ?? [];
      if (!difficulties.includes(selectedDifficulty)) {
        setSelectedDifficulty('');
      }
    }
  }, [availableOptions.difficultyLevels, selectedExam, selectedDifficulty]);

  const enabledExamTypes = availableOptions.examTypes ?? [];

  const generateHelmChart = async () => {
    if (!selectedExam || !selectedDifficulty) return;

    setIsGenerating(true);
    // Reset states when generating new chart
    setHelmChartReady(false);
    setHelmApplied(false);
    setHelmDownloaded(false);
    setApplyError('');
    setStreamingLogs([]);

    try {
      const response = await axios.post('/api/helm/generate', {
        type: selectedExam,
        difficulty: selectedDifficulty,
        practiceMode: practiceMode
      });

      if (response.data.success) {
        setHelmChartReady(true);
      }
    } catch (error) {
      console.error('Error generating Helm chart:', error);
      alert('Failed to generate Helm chart. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadHelmChart = async () => {
    try {
      const response = await axios.get('/api/helm/download', {
        responseType: 'blob',
        params: {
          type: selectedExam,
          difficulty: selectedDifficulty,
          practiceMode: practiceMode
        }
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `k8s-exam-${selectedExam}-${selectedDifficulty}.tgz`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Mark as downloaded - user will apply it themselves
      setHelmDownloaded(true);
    } catch (error) {
      console.error('Error downloading Helm chart:', error);
      alert('Failed to download Helm chart. Please try again.');
    }
  };

  const applyHelmChart = () => {
    setIsApplying(true);
    setApplyError('');
    setStreamingLogs([]);
    setShowLogs(true);

    // Use EventSource with GET request (EventSource only supports GET)
    const url = `/api/helm/apply-stream?type=${encodeURIComponent(selectedExam)}&difficulty=${encodeURIComponent(selectedDifficulty)}&practiceMode=${practiceMode}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log('✅ Streaming connection opened');
  setStreamingLogs((prev: string[]) => [...prev, '🔗 Connected to deployment stream...']);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
  setStreamingLogs((prev: string[]) => [...prev, data.message]);
      } catch (parseError) {
        console.error('Error parsing message data:', parseError);
      }
    };

    eventSource.addEventListener('progress', (event) => {
      try {
        const data = JSON.parse(event.data);
  setStreamingLogs((prev: string[]) => [...prev, data.message]);
      } catch (parseError) {
        console.error('Error parsing progress data:', parseError);
      }
    });

    eventSource.addEventListener('complete', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.success) {
          setHelmApplied(true);
          setStreamingLogs((prev: string[]) => [...prev, '🎉 Deployment completed successfully!']);
        } else {
          setApplyError(data.error || 'Failed to apply Helm chart');
          setStreamingLogs((prev: string[]) => [...prev, `❌ Error: ${data.error || 'Unknown error'}`]);
        }
      } catch (parseError) {
        console.error('Error parsing completion data:', parseError);
        setApplyError('Failed to parse completion data');
      }
      setIsApplying(false);
      eventSource.close();
    });

    eventSource.addEventListener('error', (event) => {
      try {
        const data = JSON.parse((event as any).data || '{}');
        setApplyError(data.error || 'Failed to apply Helm chart');
  setStreamingLogs((prev: string[]) => [...prev, `❌ Error: ${data.error || 'Connection error'}`]);
      } catch (parseError) {
        console.error('Error parsing error data:', parseError);
        setApplyError('Failed to apply Helm chart. Please ensure your cluster is accessible.');
  setStreamingLogs((prev: string[]) => [...prev, '❌ Connection error or deployment failed']);
      }
      setIsApplying(false);
      eventSource.close();
    });

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      if (eventSource.readyState === EventSource.CLOSED) {
        setApplyError('Connection lost. Please try again.');
  setStreamingLogs((prev: string[]) => [...prev, '❌ Connection lost']);
      } else {
        setApplyError('Connection error. Please try again.');
  setStreamingLogs((prev: string[]) => [...prev, '❌ Connection error']);
      }
      setIsApplying(false);
      eventSource.close();
    };

    // Cleanup function
    const cleanup = () => {
      eventSource.close();
    };

    // Store cleanup function for potential component unmount
    (window as any).cleanupEventSource = cleanup;
  };

  const createExamAndNavigate = async () => {
    try {
      // Create exam session before navigating
      const response = await axios.post('/api/exams', {
        type: selectedExam,
        difficulty: selectedDifficulty,
        practiceMode: practiceMode
      });

      if (response.data.success) {
        // Navigate to exam interface
        window.location.href = '/exam';
      } else {
        alert('Failed to create exam session. Please try again.');
      }
    } catch (error) {
      console.error('Error creating exam session:', error);
      alert('Failed to create exam session. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Kubernetes Certification Exam Simulator
          </h1>
          <p className="text-gray-600 mb-8">
            Select your certification type and difficulty to generate a custom exam environment
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Certification</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {examTypes.map((exam) => {
              const enabled = enabledExamTypes.includes(exam.id);
              const examQuestionCounts: Record<string, number> = availableOptions.questionCounts[exam.id] ?? {};
              const totalQuestions = (Object.values(examQuestionCounts) as number[]).reduce((sum, count) => (
                sum + (typeof count === 'number' ? count : 0)
              ), 0);
              return (
                <div
                  key={exam.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedExam === exam.id
                      ? 'border-blue-500 bg-blue-50'
                      : enabled
                        ? 'border-gray-200 hover:border-gray-300'
                        : 'border-gray-100 bg-gray-100 opacity-50 cursor-not-allowed'
                  }`}
                  onClick={() => {
                    if (!enabled) return;
                    setSelectedExam(exam.id);
                    setHelmChartReady(false);
                    setHelmApplied(false);
                    setHelmDownloaded(false);
                    setApplyError('');
                    setStreamingLogs([]);
                  }}
                  aria-disabled={!enabled}
                >
                  <h3 className="font-semibold text-gray-900">{exam.name}</h3>
                  <p className="text-sm text-gray-600">
                    {exam.description}<br />
                    {` (${totalQuestions} questions)`}
                  </p>
                  {!enabled && (
                    <span className="text-xs text-gray-500 block mt-2">No questions available</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Difficulty</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {difficultyLevels.map((level) => {
              const selectedExamDifficulties = availableOptions.difficultyLevels[selectedExam] ?? [];
              const enabled = Boolean(selectedExam) && selectedExamDifficulties.includes(level.id);
              const difficultyCount = enabled
                ? availableOptions.questionCounts[selectedExam]?.[level.id] ?? 0
                : 0;
              return (
                <div
                  key={level.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedDifficulty === level.id
                      ? 'border-green-500 bg-green-50'
                      : enabled
                        ? 'border-gray-200 hover:border-gray-300'
                        : 'border-gray-100 bg-gray-100 opacity-50 cursor-not-allowed'
                  }`}
                  onClick={() => {
                    if (!enabled) return;
                    setSelectedDifficulty(level.id);
                    setHelmChartReady(false);
                    setHelmApplied(false);
                    setHelmDownloaded(false);
                    setApplyError('');
                    setStreamingLogs([]);
                  }}
                  aria-disabled={!enabled}
                >
                  <h3 className="font-semibold text-gray-900">{level.name}</h3>
                  <p className="text-sm text-gray-600">
                    {level.description}<br />
                    {selectedExam ? ` (${difficultyCount} questions)` : ''}
                  </p>
                  {!enabled && (
                    <span className="text-xs text-gray-500 block mt-2">No questions available</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Exam Mode</h2>
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={practiceMode}
                onChange={(e) => {
                  setPracticeMode(e.target.checked);
                  // Reset helm chart when practice mode changes
                  setHelmChartReady(false);
                  setHelmApplied(false);
                  setHelmDownloaded(false);
                  setApplyError('');
                  setStreamingLogs([]);
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-900">All Questions Practice Mode</span>
            </label>
          </div>
          <div className="mt-2">
            <p className="text-xs text-gray-600">
              {practiceMode
                ? "✓ Practice with all questions, no time limit, solutions visible"
                : "Standard exam mode with timed questions and limited question set"
              }
            </p>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Generate Exam Environment</h2>

          {selectedExam && selectedDifficulty ? (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Selected:</strong> {examTypes.find(e => e.id === selectedExam)?.name} - {difficultyLevels.find(d => d.id === selectedDifficulty)?.name}
                  {practiceMode && <span className="ml-2 text-xs bg-blue-200 text-blue-900 px-2 py-1 rounded">Practice Mode</span>}
                </p>
              </div>

              {!helmChartReady ? (
                <button
                  onClick={generateHelmChart}
                  disabled={isGenerating}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? 'Generating Helm Chart...' : 'Generate Helm Chart'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-800 mb-2">
                      ✅ Helm chart generated successfully!
                    </p>
                    <p className="text-xs text-green-700">
                      Download and apply manually: <code>helm install k8s-exam ./chart</code>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={downloadHelmChart}
                      className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
                    >
                      📥 Download Helm Chart
                    </button>
                    <button
                      onClick={generateHelmChart}
                      disabled={isGenerating}
                      className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGenerating ? '⏳ Regenerating...' : '🔄 Regenerate Chart'}
                    </button>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-white px-2 text-gray-500">OR</span>
                    </div>
                  </div>

                  <button
                    onClick={applyHelmChart}
                    disabled={isApplying || helmApplied}
                    className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors ${
                      helmApplied
                        ? 'bg-blue-600 cursor-default'
                        : isApplying
                        ? 'bg-gray-400 cursor-wait'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isApplying ? '⏳ Applying to Cluster...' : helmApplied ? '✅ Helm Chart Applied' : '🚀 Apply Helm Chart to Cluster'}
                  </button>

                  {(showLogs && (streamingLogs.length > 0 || isApplying)) && (
                    <div className="border rounded-lg">
                      <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                        <h3 className="text-sm font-medium text-gray-900">📺 Deployment Console</h3>
                        <button
                          onClick={() => setShowLogs(!showLogs)}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          {showLogs ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <div className="p-4 bg-black text-green-400 font-mono text-xs max-h-64 overflow-y-auto">
                        {streamingLogs.length === 0 && isApplying && (
                          <div className="text-gray-400 animate-pulse">
                            🔄 Initializing deployment stream...
                          </div>
                        )}
                        {streamingLogs.map((log, index) => (
                          <div key={index} className="mb-1">
                            {log}
                          </div>
                        ))}
                        {isApplying && streamingLogs.length > 0 && (
                          <div className="animate-pulse">▋</div>
                        )}
                      </div>
                    </div>
                  )}

                  {applyError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800">❌ {applyError}</p>
                    </div>
                  )}

                  {helmDownloaded && !helmApplied && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">📥 Helm chart downloaded. Apply it to your cluster with: <code className="bg-yellow-100 px-1 rounded">helm install k8s-exam ./chart</code></p>
                    </div>
                  )}

                  {helmApplied && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-800">✅ Helm chart has been applied to your cluster successfully!</p>
                    </div>
                  )}

                  <button
                    onClick={createExamAndNavigate}
                    disabled={!helmApplied && !helmDownloaded}
                    className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors ${
                      helmApplied || helmDownloaded
                        ? 'bg-purple-600 hover:bg-purple-700'
                        : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {helmApplied || helmDownloaded ? '▶️ Start Exam' : '⏸️ Start Exam (apply Helm chart first)'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              Please select both certification type and difficulty level to proceed.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExamSelection;
