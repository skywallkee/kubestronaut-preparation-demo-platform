const fs = require('fs').promises;
const path = require('path');

class QuestionService {
  constructor() {
    this.questionBankPath = path.join(__dirname, '../../../../../question-bank');
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
      // Load main config to get question file list
      const configPath = path.join(this.questionBankPath, examType, 'questions.json');
      const configData = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configData);

      // Map difficulty levels to directory names
      const difficultyMapping = {
        'beginner': 'easy',
        'intermediate': 'intermediate', 
        'advanced': 'hard'
      };
      
      const mappedDifficulty = difficultyMapping[difficulty] || difficulty;

      // Get question files for the specified difficulty
      const questionFiles = config.questionFiles?.[mappedDifficulty] || [];
      
      if (questionFiles.length === 0) {
        console.log(`No question files found for ${examType}-${difficulty}, falling back to mock questions`);
        return this.getMockQuestions(examType, difficulty);
      }

      // Load individual question files
      const questions = [];
      const difficultyPath = path.join(this.questionBankPath, examType, mappedDifficulty);
      
      for (const fileName of questionFiles) {
        try {
          const questionPath = path.join(difficultyPath, fileName);
          const questionData = await fs.readFile(questionPath, 'utf8');
          const question = JSON.parse(questionData);
          questions.push(question);
        } catch (error) {
          console.warn(`Failed to load question file ${fileName}:`, error.message);
        }
      }

      // Randomize and limit question count based on exam type
      const maxQuestions = this.getMaxQuestions(examType);
      const selectedQuestions = this.shuffleArray([...questions])
        .slice(0, maxQuestions);

      // Add default properties if missing and ensure consistent structure
      const processedQuestions = selectedQuestions.map((question, index) => ({
        id: index + 1,
        originalId: question.id,
        title: question.title || `Question ${index + 1}`,
        description: question.description || question.question || '',
        points: question.points || this.getDefaultPoints(examType),
        difficulty: question.difficulty || difficulty,
        category: question.category || 'General',
        timeLimit: question.timeLimit || 10,
        tags: question.tags || [],
        infrastructure: question.infrastructure || { namespaces: [], resources: [], prerequisites: [] },
        solution: question.solution || { steps: [] },
        validations: question.validations || [],
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

  async getInfrastructureRequirements(examType, difficulty) {
    // Get the questions that would be selected for the exam
    const questions = await this.getQuestions(examType, difficulty);
    
    // Aggregate infrastructure requirements from all questions
    const aggregatedRequirements = {
      namespaces: new Set(),
      resources: new Set(),
      prerequisites: [],
      deployments: new Set(),
      services: new Set(),
      configMaps: new Set(),
      secrets: new Set(),
      persistentVolumeClaims: new Set(),
      networkPolicies: new Set(),
      rbac: new Set()
    };

    // Process each question's infrastructure requirements
    questions.forEach(question => {
      const infra = question.infrastructure || {};
      
      // Add namespaces
      if (infra.namespaces) {
        infra.namespaces.forEach(ns => aggregatedRequirements.namespaces.add(ns));
      }
      
      // Add resources
      if (infra.resources) {
        infra.resources.forEach(resource => aggregatedRequirements.resources.add(resource));
      }
      
      // Add prerequisites
      if (infra.prerequisites) {
        aggregatedRequirements.prerequisites.push(...infra.prerequisites);
      }

      // Extract specific resource types from question content and tags
      this.extractResourceTypes(question, aggregatedRequirements);
    });

    // Convert Sets to Arrays for JSON serialization
    const requirements = {
      namespaces: Array.from(aggregatedRequirements.namespaces),
      resources: Array.from(aggregatedRequirements.resources),
      prerequisites: aggregatedRequirements.prerequisites,
      deployments: Array.from(aggregatedRequirements.deployments),
      services: Array.from(aggregatedRequirements.services),
      configMaps: Array.from(aggregatedRequirements.configMaps),
      secrets: Array.from(aggregatedRequirements.secrets),
      persistentVolumeClaims: Array.from(aggregatedRequirements.persistentVolumeClaims),
      networkPolicies: Array.from(aggregatedRequirements.networkPolicies),
      rbac: Array.from(aggregatedRequirements.rbac)
    };

    console.log(`Infrastructure requirements for ${examType}-${difficulty}:`, requirements);
    return requirements;
  }

  extractResourceTypes(question, aggregated) {
    const title = (question.title || '').toLowerCase();
    const description = (question.description || '').toLowerCase();
    const tags = question.tags || [];
    const category = (question.category || '').toLowerCase();

    // Check for deployments
    if (title.includes('deployment') || description.includes('deployment') || 
        tags.includes('deployments') || category.includes('deployment')) {
      aggregated.deployments.add('deployment-resources');
    }

    // Check for services
    if (title.includes('service') || description.includes('service') || 
        tags.includes('services') || category.includes('service')) {
      aggregated.services.add('service-resources');
    }

    // Check for configmaps
    if (title.includes('configmap') || description.includes('configmap') || 
        tags.includes('configmap') || category.includes('configuration')) {
      aggregated.configMaps.add('configmap-resources');
    }

    // Check for secrets
    if (title.includes('secret') || description.includes('secret') || 
        tags.includes('secrets') || category.includes('secret')) {
      aggregated.secrets.add('secret-resources');
    }

    // Check for PVCs
    if (title.includes('pvc') || title.includes('persistentvolumeclaim') || 
        description.includes('persistentvolumeclaim') || tags.includes('pvc') || 
        category.includes('storage')) {
      aggregated.persistentVolumeClaims.add('pvc-resources');
    }

    // Check for Network Policies
    if (title.includes('network') || description.includes('network') || 
        tags.includes('networking') || category.includes('network')) {
      aggregated.networkPolicies.add('network-policy-resources');
    }

    // Check for RBAC
    if (title.includes('rbac') || title.includes('role') || title.includes('serviceaccount') ||
        description.includes('rbac') || tags.includes('rbac') || category.includes('security')) {
      aggregated.rbac.add('rbac-resources');
    }
  }

  clearCache() {
    this.cache.clear();
    console.log('Question cache cleared');
  }
}

module.exports = new QuestionService();