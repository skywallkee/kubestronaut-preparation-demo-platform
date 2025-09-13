import React, { useState } from 'react';
import axios from 'axios';

interface ExamConfig {
  type: string;
  difficulty: string;
}

const ExamSelection: React.FC = () => {
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [helmChartReady, setHelmChartReady] = useState<boolean>(false);

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

  const generateHelmChart = async () => {
    if (!selectedExam || !selectedDifficulty) return;

    setIsGenerating(true);
    try {
      const response = await axios.post('/api/helm/generate', {
        type: selectedExam,
        difficulty: selectedDifficulty
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
          difficulty: selectedDifficulty
        }
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `k8s-exam-${selectedExam}-${selectedDifficulty}.tgz`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading Helm chart:', error);
      alert('Failed to download Helm chart. Please try again.');
    }
  };

  const createExamAndNavigate = async () => {
    try {
      // Create exam session before navigating
      const response = await axios.post('/api/exams', {
        type: selectedExam,
        difficulty: selectedDifficulty
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
            {examTypes.map((exam) => (
              <div
                key={exam.id}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedExam === exam.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedExam(exam.id)}
              >
                <h3 className="font-semibold text-gray-900">{exam.name}</h3>
                <p className="text-sm text-gray-600">{exam.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Difficulty</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {difficultyLevels.map((level) => (
              <div
                key={level.id}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedDifficulty === level.id
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedDifficulty(level.id)}
              >
                <h3 className="font-semibold text-gray-900">{level.name}</h3>
                <p className="text-sm text-gray-600">{level.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Generate Exam Environment</h2>
          
          {selectedExam && selectedDifficulty ? (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Selected:</strong> {examTypes.find(e => e.id === selectedExam)?.name} - {difficultyLevels.find(d => d.id === selectedDifficulty)?.name}
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
                      Download and apply to your cluster: <code>helm install k8s-exam ./chart</code>
                    </p>
                  </div>
                  
                  <button
                    onClick={downloadHelmChart}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
                  >
                    Download Helm Chart
                  </button>
                  
                  <button
                    onClick={createExamAndNavigate}
                    className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700"
                  >
                    Start Exam (after applying Helm chart)
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