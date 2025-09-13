const fs = require('fs').promises;
const path = require('path');

class QuestionService {
  constructor() {
    this.questionBankPath = path.join(__dirname, '../../../../question-bank');
    this.cache = new Map();
  }

  async getQuestions(examType, difficulty) {
    const cacheKey = `${examType}-${difficulty}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log(`Returning cached questions for ${cacheKey}`);
      return this.cache.get(cacheKey);
    }

    try {
      // Load questions from JSON file
      const questionsPath = path.join(this.questionBankPath, examType, 'questions.json');
      const questionsData = await fs.readFile(questionsPath, 'utf8');
      const allQuestions = JSON.parse(questionsData);

      // Filter by difficulty if questions have difficulty levels
      let filteredQuestions = allQuestions.questions || allQuestions;
      
      if (Array.isArray(filteredQuestions)) {
        filteredQuestions = filteredQuestions.filter(q => 
          !q.difficulty || q.difficulty === difficulty || difficulty === 'intermediate'
        );
      }

      // Randomize and limit question count based on exam type
      const maxQuestions = this.getMaxQuestions(examType);
      const selectedQuestions = this.shuffleArray([...filteredQuestions])
        .slice(0, maxQuestions);

      // Add default properties if missing
      const processedQuestions = selectedQuestions.map((question, index) => ({
        id: index + 1,
        title: question.title || `Question ${index + 1}`,
        description: question.description || question.question || '',
        points: question.points || this.getDefaultPoints(examType),
        difficulty: question.difficulty || difficulty,
        category: question.category || 'General',
        ...question
      }));

      // Cache the result
      this.cache.set(cacheKey, processedQuestions);
      
      console.log(`Loaded ${processedQuestions.length} questions for ${examType}-${difficulty}`);
      return processedQuestions;
      
    } catch (error) {
      console.error(`Error loading questions for ${examType}-${difficulty}:`, error.message);
      
      // Return mock questions if file not found
      return this.getMockQuestions(examType, difficulty);
    }
  }

  getMockQuestions(examType, difficulty) {
    console.log(`Generating mock questions for ${examType}-${difficulty}`);
    
    const baseQuestions = {
      ckad: [
        {
          id: 1,
          title: "Create a Pod",
          description: "Create a Pod named 'web-pod' using the nginx:1.20 image. The Pod should be in the default namespace.",
          points: 4,
          category: "Pods"
        },
        {
          id: 2,
          title: "Create a Deployment",
          description: "Create a Deployment named 'app-deploy' with 3 replicas using the httpd:2.4 image.",
          points: 6,
          category: "Deployments"
        },
        {
          id: 3,
          title: "Expose a Service",
          description: "Create a Service to expose the 'app-deploy' Deployment on port 80.",
          points: 5,
          category: "Services"
        }
      ],
      cka: [
        {
          id: 1,
          title: "Backup etcd",
          description: "Create a backup of the etcd database and save it to /tmp/etcd-backup.db",
          points: 8,
          category: "Cluster Maintenance"
        },
        {
          id: 2,
          title: "Add a Worker Node",
          description: "Join a new worker node to the cluster. The node should be ready and available.",
          points: 10,
          category: "Cluster Management"
        }
      ],
      cks: [
        {
          id: 1,
          title: "Network Policy",
          description: "Create a NetworkPolicy that only allows ingress traffic from pods with label 'role=frontend'",
          points: 7,
          category: "Network Security"
        }
      ],
      kcna: [
        {
          id: 1,
          title: "Identify Pod Components",
          description: "List all the components that make up a Pod and explain their purposes.",
          points: 3,
          category: "Kubernetes Basics"
        }
      ]
    };

    const questions = baseQuestions[examType] || baseQuestions.ckad;
    const maxQuestions = this.getMaxQuestions(examType);
    
    // Duplicate questions if we need more
    let result = [...questions];
    while (result.length < maxQuestions) {
      result = [...result, ...questions];
    }
    
    return result.slice(0, maxQuestions).map((q, index) => ({
      ...q,
      id: index + 1,
      difficulty,
      flagged: false,
      completed: false
    }));
  }

  getMaxQuestions(examType) {
    const counts = {
      'ckad': 19,
      'cka': 17,
      'cks': 16,
      'kcna': 60
    };

    return counts[examType] || 15;
  }

  getDefaultPoints(examType) {
    const defaultPoints = {
      'ckad': 4,
      'cka': 6,
      'cks': 5,
      'kcna': 2
    };

    return defaultPoints[examType] || 4;
  }

  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  clearCache() {
    this.cache.clear();
    console.log('Question cache cleared');
  }
}

module.exports = new QuestionService();