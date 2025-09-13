const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');

class HelmService {
  constructor() {
    this.templatesPath = path.join(__dirname, '../../../../helm-templates');
    this.generatedChartsPath = path.join(__dirname, '../../../../generated-charts');
    this.cache = new Map();
  }

  async generateChart(examType, difficulty) {
    const chartId = `${examType}-${difficulty}`;
    console.log(`Generating Helm chart for ${chartId}`);

    try {
      // Ensure generated charts directory exists
      await this.ensureDirectoryExists(this.generatedChartsPath);

      const chartPath = path.join(this.generatedChartsPath, chartId);
      
      // Create chart directory
      await this.ensureDirectoryExists(chartPath);
      
      // Generate chart files
      await this.generateChartYaml(chartPath, examType, difficulty);
      await this.generateValuesYaml(chartPath, examType, difficulty);
      await this.generateTemplates(chartPath, examType, difficulty);

      console.log(`Helm chart generated successfully at ${chartPath}`);
      return chartPath;

    } catch (error) {
      console.error(`Error generating chart for ${chartId}:`, error);
      throw new Error(`Failed to generate Helm chart: ${error.message}`);
    }
  }

  async generateChartYaml(chartPath, examType, difficulty) {
    const chartYaml = {
      apiVersion: 'v2',
      name: `k8s-exam-${examType}-${difficulty}`,
      description: `Kubernetes ${examType.toUpperCase()} exam environment - ${difficulty} level`,
      version: '1.0.0',
      appVersion: '1.0.0',
      keywords: ['kubernetes', 'exam', 'certification', examType],
      home: 'https://github.com/kubernetes-exam-simulator',
      maintainers: [
        {
          name: 'K8s Exam Simulator',
          email: 'noreply@k8s-exam.local'
        }
      ]
    };

    const yamlContent = Object.entries(chartYaml)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}:\n${value.map(item => 
            typeof item === 'object' 
              ? Object.entries(item).map(([k, v]) => `  - ${k}: ${v}`).join('\n')
              : `  - ${item}`
          ).join('\n')}`;
        }
        return `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`;
      })
      .join('\n');

    await fs.writeFile(path.join(chartPath, 'Chart.yaml'), yamlContent);
  }

  async generateValuesYaml(chartPath, examType, difficulty) {
    const values = this.getDefaultValues(examType, difficulty);
    
    const valuesYaml = this.objectToYaml(values, 0);
    await fs.writeFile(path.join(chartPath, 'values.yaml'), valuesYaml);
  }

  async generateTemplates(chartPath, examType, difficulty) {
    const templatesPath = path.join(chartPath, 'templates');
    await this.ensureDirectoryExists(templatesPath);

    // Generate namespace template
    await this.generateNamespaceTemplate(templatesPath, examType, difficulty);
    
    // Generate exam environment templates based on type
    switch (examType) {
      case 'ckad':
        await this.generateCKADTemplates(templatesPath, difficulty);
        break;
      case 'cka':
        await this.generateCKATemplates(templatesPath, difficulty);
        break;
      case 'cks':
        await this.generateCKSTemplates(templatesPath, difficulty);
        break;
      case 'kcna':
        await this.generateKCNATemplates(templatesPath, difficulty);
        break;
      default:
        await this.generateBasicTemplates(templatesPath, difficulty);
    }

    // Generate NOTES.txt
    await this.generateNotes(templatesPath, examType, difficulty);
  }

  async generateNamespaceTemplate(templatesPath, examType, difficulty) {
    const namespaceTemplate = `apiVersion: v1
kind: Namespace
metadata:
  name: k8s-exam-${examType}
  labels:
    app.kubernetes.io/name: k8s-exam
    app.kubernetes.io/component: ${examType}
    app.kubernetes.io/difficulty: ${difficulty}
    app.kubernetes.io/managed-by: helm
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: exam-config
  namespace: k8s-exam-${examType}
data:
  exam-type: "${examType}"
  difficulty: "${difficulty}"
  instructions: |
    Welcome to the ${examType.toUpperCase()} exam environment!
    
    This is a ${difficulty} level exam simulation.
    
    Use kubectl commands to interact with this cluster.
    All exam resources will be created in the k8s-exam-${examType} namespace.
    
    Good luck!`;

    await fs.writeFile(path.join(templatesPath, 'namespace.yaml'), namespaceTemplate);
  }

  async generateCKADTemplates(templatesPath, difficulty) {
    // Generate CKAD-specific templates (Pods, Deployments, Services, etc.)
    const templates = [
      {
        name: 'sample-pod.yaml',
        content: `apiVersion: v1
kind: Pod
metadata:
  name: sample-pod
  namespace: k8s-exam-ckad
  labels:
    app: sample-app
spec:
  containers:
  - name: nginx
    image: nginx:1.20
    ports:
    - containerPort: 80`
      },
      {
        name: 'sample-deployment.yaml',
        content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: sample-deployment
  namespace: k8s-exam-ckad
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sample-app
  template:
    metadata:
      labels:
        app: sample-app
    spec:
      containers:
      - name: nginx
        image: nginx:1.20
        ports:
        - containerPort: 80`
      }
    ];

    for (const template of templates) {
      await fs.writeFile(path.join(templatesPath, template.name), template.content);
    }
  }

  async generateCKATemplates(templatesPath, difficulty) {
    // Generate CKA-specific templates (cluster admin tasks)
    const templates = [
      {
        name: 'cluster-role.yaml',
        content: `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: exam-cluster-role
rules:
- apiGroups: [""]
  resources: ["nodes", "pods"]
  verbs: ["get", "list", "watch"]`
      }
    ];

    for (const template of templates) {
      await fs.writeFile(path.join(templatesPath, template.name), template.content);
    }
  }

  async generateCKSTemplates(templatesPath, difficulty) {
    // Generate CKS-specific templates (security-focused)
    const templates = [
      {
        name: 'network-policy.yaml',
        content: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
  namespace: k8s-exam-cks
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress`
      }
    ];

    for (const template of templates) {
      await fs.writeFile(path.join(templatesPath, template.name), template.content);
    }
  }

  async generateKCNATemplates(templatesPath, difficulty) {
    // Generate KCNA-specific templates (basic resources)
    await this.generateBasicTemplates(templatesPath, difficulty);
  }

  async generateBasicTemplates(templatesPath, difficulty) {
    // Generate basic templates for any exam type
    const basicTemplate = `# Basic template for ${difficulty} level exam
# This template provides a starting point for exam tasks`;
    
    await fs.writeFile(path.join(templatesPath, 'README.md'), basicTemplate);
  }

  async generateNotes(templatesPath, examType, difficulty) {
    const notes = `EXAM ENVIRONMENT DEPLOYED SUCCESSFULLY!

Exam Type: ${examType.toUpperCase()}
Difficulty: ${difficulty}
Namespace: k8s-exam-${examType}

To verify your environment:
  kubectl get pods -n k8s-exam-${examType}
  kubectl get configmap exam-config -n k8s-exam-${examType} -o yaml

To start working on exam tasks:
  kubectl config set-context --current --namespace=k8s-exam-${examType}

Important Notes:
- Use the k8s-exam-${examType} namespace for your work
- All exam resources should be created in this namespace
- Check the exam-config ConfigMap for additional instructions

Good luck with your ${examType.toUpperCase()} exam!`;

    await fs.writeFile(path.join(templatesPath, 'NOTES.txt'), notes);
  }

  async getChartArchive(examType, difficulty) {
    const chartId = `${examType}-${difficulty}`;
    const chartPath = path.join(this.generatedChartsPath, chartId);

    try {
      // Check if chart exists
      await fs.access(chartPath);

      // Create archive
      return await this.createArchive(chartPath, chartId);
    } catch (error) {
      console.error(`Chart not found for ${chartId}:`, error.message);
      return null;
    }
  }

  async createArchive(chartPath, chartId) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      const archive = archiver('tar', {
        gzip: true,
        gzipOptions: {
          level: 9
        }
      });

      archive.on('error', reject);
      archive.on('data', chunk => chunks.push(chunk));
      archive.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });

      // Add chart directory to archive
      archive.directory(chartPath, chartId);
      archive.finalize();
    });
  }

  async checkChartStatus(examType, difficulty) {
    // Mock implementation - in a real scenario, this would check actual Kubernetes cluster
    const releaseName = `k8s-exam-${examType}-${difficulty}`;
    
    return {
      applied: false, // Would check with kubectl/helm commands
      releaseName,
      namespace: `k8s-exam-${examType}`,
      status: 'not-found',
      nodes: [],
      message: 'Chart status check is simulated. In a real environment, this would check the actual cluster.'
    };
  }

  async getAvailableTemplates() {
    try {
      const templates = [];
      const examTypes = ['ckad', 'cka', 'cks', 'kcna'];
      
      for (const type of examTypes) {
        templates.push({
          examType: type,
          name: `${type.toUpperCase()} Exam Environment`,
          description: `Kubernetes ${type.toUpperCase()} certification exam simulator`,
          difficulties: ['beginner', 'intermediate', 'advanced']
        });
      }

      return templates;
    } catch (error) {
      console.error('Error getting available templates:', error);
      throw new Error('Failed to get available templates');
    }
  }

  async cleanupGeneratedCharts() {
    try {
      await fs.rmdir(this.generatedChartsPath, { recursive: true });
      await this.ensureDirectoryExists(this.generatedChartsPath);
      console.log('Generated charts cleaned up successfully');
    } catch (error) {
      console.error('Error cleaning up generated charts:', error);
      throw new Error('Failed to cleanup generated charts');
    }
  }

  getDefaultValues(examType, difficulty) {
    return {
      global: {
        namespace: `k8s-exam-${examType}`,
        examType,
        difficulty
      },
      exam: {
        type: examType,
        difficulty,
        timeLimit: this.getTimeLimit(examType),
        passingScore: 67
      },
      resources: {
        requests: {
          memory: '64Mi',
          cpu: '50m'
        },
        limits: {
          memory: '128Mi',
          cpu: '100m'
        }
      },
      nodeSelector: {},
      tolerations: [],
      affinity: {}
    };
  }

  getTimeLimit(examType) {
    const timeLimits = {
      'ckad': '2h',
      'cka': '3h',
      'cks': '2h',
      'kcna': '1.5h'
    };

    return timeLimits[examType] || '2h';
  }

  objectToYaml(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    let yaml = '';

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        yaml += `${spaces}${key}: null\n`;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        yaml += `${spaces}${key}:\n${this.objectToYaml(value, indent + 1)}`;
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          if (typeof item === 'object') {
            yaml += `${spaces}  -\n${this.objectToYaml(item, indent + 2)}`;
          } else {
            yaml += `${spaces}  - ${item}\n`;
          }
        }
      } else {
        yaml += `${spaces}${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}\n`;
      }
    }

    return yaml;
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
}

module.exports = new HelmService();