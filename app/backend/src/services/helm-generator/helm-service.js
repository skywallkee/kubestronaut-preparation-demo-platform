const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const QuestionService = require('../question-provider/question-service');

class HelmService {
  constructor() {
    // Use environment variables if set (for Docker), otherwise use relative paths
    this.templatesPath = process.env.HELM_TEMPLATES_PATH ||
                        path.join(__dirname, '../../../../helm-templates');
    this.generatedChartsPath = process.env.GENERATED_CHARTS_PATH ||
                               path.join(__dirname, '../../../../generated-charts');
    this.cache = new Map();
    console.log(`HelmService initialized:`);
    console.log(`  Charts path: ${this.generatedChartsPath}`);
    console.log(`  Templates path: ${this.templatesPath}`);
  }

  async generateChart(examType, difficulty, practiceMode = false) {
    const chartId = `${examType}-${difficulty}${practiceMode ? '-practice' : ''}`;
    console.log(`Generating Helm chart for ${chartId} at ${this.generatedChartsPath}`);

    try {
      // Clear question cache to ensure fresh randomization for each generation
      QuestionService.clearCache();
      console.log(`Cleared question cache for fresh randomization of ${chartId}`);

      // Also clear any existing chart cache for this configuration
      if (this.cache.has(chartId)) {
        this.cache.delete(chartId);
        console.log(`Cleared existing chart cache for ${chartId}`);
      }

      // Ensure generated charts directory exists
      await this.ensureDirectoryExists(this.generatedChartsPath);

      const chartPath = path.join(this.generatedChartsPath, chartId);

      // Create chart directory
      await this.ensureDirectoryExists(chartPath);

      // Get infrastructure requirements from selected questions
      const infrastructure = await QuestionService.getInfrastructureRequirements(examType, difficulty, practiceMode);

      // Generate chart files with infrastructure requirements
      await this.generateChartYaml(chartPath, examType, difficulty, infrastructure, practiceMode);
      await this.generateValuesYaml(chartPath, examType, difficulty, infrastructure, practiceMode);
      await this.generateTemplates(chartPath, examType, difficulty, infrastructure, practiceMode);

      // Create and cache the archive immediately after generation
      console.log(`Creating and caching archive for ${chartId}...`);
      const archive = await this.createArchive(chartPath, chartId);

      // Store in cache for later retrieval
      this.cache.set(chartId, archive);
      console.log(`Chart archive cached for ${chartId}, size: ${archive.length} bytes`);

      console.log(`Helm chart generated successfully at ${chartPath}`);
      return chartPath;

    } catch (error) {
      console.error(`Error generating chart for ${chartId}:`, error);
      throw new Error(`Failed to generate Helm chart: ${error.message}`);
    }
  }

  async generateChartYaml(chartPath, examType, difficulty, infrastructure, practiceMode = false) {
    const chartYaml = {
      apiVersion: 'v2',
      name: `k8s-exam-${examType}-${difficulty}${practiceMode ? '-practice' : ''}`,
      description: `Kubernetes ${examType.toUpperCase()} exam environment - ${difficulty} level${practiceMode ? ' (Practice Mode)' : ''}`,
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

  async generateValuesYaml(chartPath, examType, difficulty, infrastructure, practiceMode = false) {
    const values = this.getDefaultValues(examType, difficulty);

    const valuesYaml = this.objectToYaml(values, 0);
    await fs.writeFile(path.join(chartPath, 'values.yaml'), valuesYaml);
  }

  async generateTemplates(chartPath, examType, difficulty, infrastructure, practiceMode = false) {
    const templatesPath = path.join(chartPath, 'templates');
    await this.ensureDirectoryExists(templatesPath);

    // Generate namespace template
    await this.generateNamespaceTemplate(templatesPath, examType, difficulty, infrastructure);

    // Generate exam environment templates based on type and infrastructure requirements
    switch (examType) {
      case 'ckad':
        await this.generateCKADTemplates(templatesPath, difficulty, infrastructure);
        break;
      case 'cka':
        await this.generateCKATemplates(templatesPath, difficulty, infrastructure);
        break;
      case 'cks':
        await this.generateCKSTemplates(templatesPath, difficulty, infrastructure);
        break;
      case 'kcna':
        await this.generateKCNATemplates(templatesPath, difficulty, infrastructure);
        break;
      default:
        await this.generateBasicTemplates(templatesPath, difficulty, infrastructure);
    }

    // Generate NOTES.txt with infrastructure requirements
    await this.generateNotes(templatesPath, examType, difficulty, infrastructure, practiceMode);
  }

  async generateNamespaceTemplate(templatesPath, examType, difficulty, infrastructure) {
    const planetaryNamespaces = ['saturn', 'venus', 'pluto', 'mars', 'mercury', 'jupiter', 'uranus', 'neptune'];

    // Get all unique namespaces from infrastructure requirements
    let allNamespaces = new Set([...planetaryNamespaces]);

    // Add namespaces from infrastructure requirements
    if (infrastructure && infrastructure.namespaces) {
      infrastructure.namespaces.forEach(ns => allNamespaces.add(ns));
    }

    let namespaceTemplate = '';

    // Generate all namespaces (planetary + infrastructure)
    Array.from(allNamespaces).forEach((namespace, index) => {
      if (index > 0) namespaceTemplate += '---\n';
      namespaceTemplate += `apiVersion: v1
kind: Namespace
metadata:
  name: ${namespace}
  labels:
    app.kubernetes.io/name: k8s-exam
    app.kubernetes.io/component: ${examType}
    app.kubernetes.io/difficulty: ${difficulty}
    app.kubernetes.io/managed-by: helm
    planet: ${namespace}
`;
    });

    // Add main exam namespace for compatibility
    namespaceTemplate += `---
apiVersion: v1
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
  planetary-namespaces: "saturn,venus,pluto,mars"
  instructions: |
    Welcome to the ${examType.toUpperCase()} exam environment!

    This is a ${difficulty} level exam simulation.

    IMPORTANT: Questions will use these 4 planetary namespaces:
    - saturn (for questions 1-12)
    - venus (for questions 13-25)
    - pluto (for questions 26-37)
    - mars (for questions 38-50)

    Use kubectl commands to interact with these namespaces.
    Example: kubectl get pods -n saturn

    Good luck!`;

    await fs.writeFile(path.join(templatesPath, 'namespace.yaml'), namespaceTemplate);
  }

  async generateCKADTemplates(templatesPath, difficulty, infrastructure) {
    // Generate CKAD-specific templates based on infrastructure requirements
    const templates = [];
    const planetaryNamespaces = ['saturn', 'venus', 'pluto', 'mars', 'mercury', 'jupiter', 'uranus', 'neptune'];

    // Generate specific prerequisites first (these are exact resources needed by questions)
    if (infrastructure.parsedPrerequisites) {
      // Generate specific deployments from prerequisites
      Object.entries(infrastructure.parsedPrerequisites.deployments).forEach(([key, resource]) => {
        const {name: deploymentName, namespace} = resource;
        templates.push({
          name: `prereq-deployment-${deploymentName}-${namespace}.yaml`,
          content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${deploymentName}
  namespace: ${namespace}
  labels:
    app: ${deploymentName}
    exam-resource: "true"
    type: "prerequisite"
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ${deploymentName}
  template:
    metadata:
      labels:
        app: ${deploymentName}
        tier: frontend
    spec:
      containers:
      - name: web
        image: nginx:1.20-alpine
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"`
        });
        console.log(`Created prerequisite deployment: ${deploymentName} in namespace ${namespace}`);
      });

      // Generate specific ConfigMaps from prerequisites
      Object.entries(infrastructure.parsedPrerequisites.configMaps).forEach(([key, resource]) => {
        const {name: configMapName, namespace} = resource;
        templates.push({
          name: `prereq-configmap-${configMapName}-${namespace}.yaml`,
          content: `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${configMapName}
  namespace: ${namespace}
  labels:
    exam-resource: "true"
    type: "prerequisite"
data:
  database_url: "mysql://localhost:3306/mydb"
  app_config: |
    debug=false
    environment=exam
    namespace=${namespace}
  config.yaml: |
    server:
      port: 8080
      timeout: 30s`
        });
        console.log(`Created prerequisite configmap: ${configMapName} in namespace ${namespace}`);
      });

      // Generate specific Secrets from prerequisites
      Object.entries(infrastructure.parsedPrerequisites.secrets).forEach(([key, resource]) => {
        const {name: secretName, namespace} = resource;
        templates.push({
          name: `prereq-secret-${secretName}-${namespace}.yaml`,
          content: `apiVersion: v1
kind: Secret
metadata:
  name: ${secretName}
  namespace: ${namespace}
  labels:
    exam-resource: "true"
    type: "prerequisite"
type: Opaque
data:
  username: YWRtaW4=  # admin
  password: c2VjcmV0MTIz  # secret123`
        });
        console.log(`Created prerequisite secret: ${secretName} in namespace ${namespace}`);
      });

      // Generate specific ServiceAccounts from prerequisites
      Object.entries(infrastructure.parsedPrerequisites.serviceAccounts).forEach(([key, resource]) => {
        const {name: saName, namespace} = resource;
        templates.push({
          name: `prereq-serviceaccount-${saName}-${namespace}.yaml`,
          content: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${saName}
  namespace: ${namespace}
  labels:
    exam-resource: "true"
    type: "prerequisite"`
        });
        console.log(`Created prerequisite serviceaccount: ${saName} in namespace ${namespace}`);
      });

      // Generate specific Pods from prerequisites
      Object.entries(infrastructure.parsedPrerequisites.pods).forEach(([key, resource]) => {
        const {name: podName, namespace} = resource;
        templates.push({
          name: `prereq-pod-${podName}-${namespace}.yaml`,
          content: `apiVersion: v1
kind: Pod
metadata:
  name: ${podName}
  namespace: ${namespace}
  labels:
    app: ${podName}
    exam-resource: "true"
    type: "prerequisite"
spec:
  containers:
  - name: app
    image: nginx:1.20-alpine
    ports:
    - containerPort: 80
    livenessProbe:
      httpGet:
        path: /
        port: 80
      initialDelaySeconds: 10
      periodSeconds: 5
    resources:
      requests:
        memory: "32Mi"
        cpu: "25m"`
        });
        console.log(`Created prerequisite pod: ${podName} in namespace ${namespace}`);
      });

      // Generate specific PVCs from prerequisites
      Object.entries(infrastructure.parsedPrerequisites.pvcs).forEach(([key, resource]) => {
        const {name: pvcName, namespace} = resource;
        templates.push({
          name: `prereq-pvc-${pvcName}-${namespace}.yaml`,
          content: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ${pvcName}
  namespace: ${namespace}
  labels:
    exam-resource: "true"
    type: "prerequisite"
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi`
        });
        console.log(`Created prerequisite pvc: ${pvcName} in namespace ${namespace}`);
      });
    }

    // Generate sample deployments if needed - distribute across planetary namespaces
    if (infrastructure.deployments.length > 0) {
      planetaryNamespaces.forEach((namespace, index) => {
        templates.push({
          name: `sample-deployment-${namespace}.yaml`,
          content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: sample-deployment-${namespace}
  namespace: ${namespace}
  labels:
    app: sample-app-${namespace}
    exam-resource: "true"
    planet: ${namespace}
    type: "sample"
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sample-app-${namespace}
  template:
    metadata:
      labels:
        app: sample-app-${namespace}
        planet: ${namespace}
    spec:
      containers:
      - name: nginx
        image: nginx:1.20
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"`
        });
      });
    }

    // Generate services if needed - distribute across planetary namespaces
    if (infrastructure.services.length > 0) {
      planetaryNamespaces.forEach((namespace, index) => {
        templates.push({
          name: `sample-service-${namespace}.yaml`,
          content: `apiVersion: v1
kind: Service
metadata:
  name: sample-service-${namespace}
  namespace: ${namespace}
  labels:
    app: sample-app-${namespace}
    exam-resource: "true"
    planet: ${namespace}
spec:
  selector:
    app: sample-app-${namespace}
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP`
        });
      });
    }

    // Generate ConfigMaps if needed - distribute across planetary namespaces
    if (infrastructure.configMaps.length > 0) {
      planetaryNamespaces.forEach((namespace, index) => {
        templates.push({
          name: `sample-configmap-${namespace}.yaml`,
          content: `apiVersion: v1
kind: ConfigMap
metadata:
  name: sample-config-${namespace}
  namespace: ${namespace}
  labels:
    exam-resource: "true"
    planet: ${namespace}
data:
  app.properties: |
    debug=false
    database.host=localhost
    database.port=5432
    planet=${namespace}
  config.yaml: |
    server:
      port: 8080
      timeout: 30s
      namespace: ${namespace}`
        });
      });
    }

    // Generate Secrets if needed - distribute across planetary namespaces
    if (infrastructure.secrets.length > 0) {
      planetaryNamespaces.forEach((namespace, index) => {
        templates.push({
          name: `sample-secret-${namespace}.yaml`,
          content: `apiVersion: v1
kind: Secret
metadata:
  name: sample-secret-${namespace}
  namespace: ${namespace}
  labels:
    exam-resource: "true"
    planet: ${namespace}
type: Opaque
data:
  username: YWRtaW4=  # admin
  password: cGFzc3dvcmQ=  # password`
        });
      });
    }

    // Generate PVCs if needed - distribute across planetary namespaces
    if (infrastructure.persistentVolumeClaims.length > 0) {
      planetaryNamespaces.forEach((namespace, index) => {
        templates.push({
          name: `sample-pvc-${namespace}.yaml`,
          content: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: sample-pvc-${namespace}
  namespace: ${namespace}
  labels:
    exam-resource: "true"
    planet: ${namespace}
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi`
        });
      });
    }

    // Always include basic pod templates - one per planetary namespace
    planetaryNamespaces.forEach((namespace, index) => {
      templates.push({
        name: `sample-pod-${namespace}.yaml`,
        content: `apiVersion: v1
kind: Pod
metadata:
  name: sample-pod-${namespace}
  namespace: ${namespace}
  labels:
    app: sample-app-${namespace}
    exam-resource: "true"
    planet: ${namespace}
spec:
  containers:
  - name: nginx
    image: nginx:1.20
    ports:
    - containerPort: 80
    resources:
      requests:
        memory: "64Mi"
        cpu: "50m"
      limits:
        memory: "128Mi"
        cpu: "100m"`
      });
    });

    // Write all templates to files
    for (const template of templates) {
      await fs.writeFile(path.join(templatesPath, template.name), template.content);
    }

    console.log(`Generated ${templates.length} CKAD templates based on infrastructure requirements`);
  }

  async generateCKATemplates(templatesPath, difficulty, infrastructure) {
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

  async generateCKSTemplates(templatesPath, difficulty, infrastructure) {
    // Generate CKS-specific templates (security-focused)
    const planetaryNamespaces = ['saturn', 'venus', 'pluto', 'mars', 'mercury', 'jupiter', 'uranus', 'neptune'];
    const templates = [];

    // Generate network policies for each planetary namespace
    planetaryNamespaces.forEach((namespace, index) => {
      templates.push({
        name: `network-policy-${namespace}.yaml`,
        content: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-${namespace}
  namespace: ${namespace}
  labels:
    planet: ${namespace}
    exam-resource: "true"
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress`
      });
    });

    for (const template of templates) {
      await fs.writeFile(path.join(templatesPath, template.name), template.content);
    }
  }

  async generateKCNATemplates(templatesPath, difficulty, infrastructure) {
    // Generate KCNA-specific templates (basic resources)
    await this.generateBasicTemplates(templatesPath, difficulty, infrastructure);
  }

  async generateBasicTemplates(templatesPath, difficulty, infrastructure) {
    // Generate basic templates for any exam type
    const basicTemplate = `# Basic template for ${difficulty} level exam
# This template provides a starting point for exam tasks`;

    await fs.writeFile(path.join(templatesPath, 'README.md'), basicTemplate);
  }

  async generateNotes(templatesPath, examType, difficulty, infrastructure, practiceMode = false) {
    // Get the selected questions for verification
    let selectedQuestions = [];
    try {
      const questions = await QuestionService.getQuestions(examType, difficulty, practiceMode);
      selectedQuestions = questions.map(q => `${q.originalId || q.id}: ${q.title}`);
    } catch (error) {
      console.warn('Could not load questions for NOTES.txt:', error.message);
    }

    const notes = `EXAM ENVIRONMENT DEPLOYED SUCCESSFULLY!

Exam Type: ${examType.toUpperCase()}
Difficulty: ${difficulty}${practiceMode ? ' (Practice Mode - ALL Questions)' : ''}
Namespace: k8s-exam-${examType}

Selected Questions for this ${practiceMode ? 'Practice Session' : 'Exam'}:
${selectedQuestions.length > 0 ? selectedQuestions.map(q => `  - ${q}`).join('\n') : '  - Questions will be loaded dynamically'}

Infrastructure Deployed:
  - Namespaces: ${infrastructure.namespaces.join(', ') || 'default'}
  - Deployments: ${infrastructure.deployments.length > 0 ? '✓' : '✗'}
  - Services: ${infrastructure.services.length > 0 ? '✓' : '✗'}
  - ConfigMaps: ${infrastructure.configMaps.length > 0 ? '✓' : '✗'}
  - Secrets: ${infrastructure.secrets.length > 0 ? '✓' : '✗'}
  - PVCs: ${infrastructure.persistentVolumeClaims.length > 0 ? '✓' : '✗'}
  - Network Policies: ${infrastructure.networkPolicies.length > 0 ? '✓' : '✗'}
  - RBAC: ${infrastructure.rbac.length > 0 ? '✓' : '✗'}

To verify your environment:
  kubectl get pods -n k8s-exam-${examType}
  kubectl get configmap exam-config -n k8s-exam-${examType} -o yaml

To start working on exam tasks:
  kubectl config set-context --current --namespace=k8s-exam-${examType}

Important Notes:
- Use the k8s-exam-${examType} namespace for your work
- All exam resources should be created in this namespace
- Check the exam-config ConfigMap for additional instructions
- Resources marked with ✓ have sample templates deployed
- Questions listed above will be served during the exam

Good luck with your ${examType.toUpperCase()} exam!`;

    await fs.writeFile(path.join(templatesPath, 'NOTES.txt'), notes);
  }

  async getChartArchive(examType, difficulty, practiceMode = false) {
    const chartId = `${examType}-${difficulty}${practiceMode ? '-practice' : ''}`;
    const chartPath = path.join(this.generatedChartsPath, chartId);

    console.log(`Looking for chart archive for ${chartId}`);
    console.log(`Chart path: ${chartPath}`);
    console.log(`Cache contents: ${Array.from(this.cache.keys()).join(', ')}`);

    // First check cache
    if (this.cache.has(chartId)) {
      console.log(`Found cached archive for ${chartId}`);
      return this.cache.get(chartId);
    }

    // If not in cache, try to create from disk
    try {
      // Check if chart exists
      await fs.access(chartPath);
      console.log(`Chart found at ${chartPath}, creating archive...`);

      // Create archive
      const archive = await this.createArchive(chartPath, chartId);
      console.log(`Archive created successfully for ${chartId}, size: ${archive.length} bytes`);

      // Cache it for next time
      this.cache.set(chartId, archive);

      return archive;
    } catch (error) {
      console.error(`Chart not found for ${chartId} at ${chartPath}:`, error.message);

      // List available charts for debugging
      try {
        const files = await fs.readdir(this.generatedChartsPath);
        console.log(`Available charts in ${this.generatedChartsPath}: ${files.join(', ')}`);
      } catch (listError) {
        console.error(`Could not list directory ${this.generatedChartsPath}: ${listError.message}`);
      }

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

  async cleanupExamResources() {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    console.log('🧹 Cleaning up existing exam resources...');

    try {
      // List all Helm releases that look like exam releases
      const { stdout: helmList } = await execPromise('helm list -A -o json');
      const releases = JSON.parse(helmList || '[]');
      const examReleases = releases.filter(release =>
        release.name.match(/^(ckad|cka|cks|kcna)-(beginner|intermediate|advanced|easy|hard)$/)
      );

      // Uninstall exam-related Helm releases
      for (const release of examReleases) {
        console.log(`📦 Uninstalling Helm release: ${release.name} from namespace ${release.namespace}`);
        try {
          await execPromise(`helm uninstall ${release.name} -n ${release.namespace} --wait --timeout 1m`);
          console.log(`✅ Successfully uninstalled ${release.name}`);
        } catch (uninstallError) {
          console.log(`⚠️ Could not uninstall ${release.name}: ${uninstallError.message}`);
        }
      }

      // Clean up planetary namespaces and exam-related resources
      const planetaryNamespaces = ['saturn', 'venus', 'pluto', 'mars', 'mercury', 'jupiter', 'uranus', 'neptune'];
      const examNamespaces = ['k8s-exam-ckad', 'k8s-exam-cka', 'k8s-exam-cks', 'k8s-exam-kcna'];
      const allExamNamespaces = [...planetaryNamespaces, ...examNamespaces];

      for (const ns of allExamNamespaces) {
        try {
          // Check if namespace exists first
          await execPromise(`kubectl get namespace ${ns}`);
          console.log(`🌍 Deleting namespace: ${ns}`);
          await execPromise(`kubectl delete namespace ${ns} --ignore-not-found=true --timeout=60s`);
          console.log(`✅ Successfully deleted namespace ${ns}`);
        } catch (nsError) {
          // Namespace doesn't exist or couldn't be deleted, which is fine
          console.log(`ℹ️ Namespace ${ns} doesn't exist or already deleted`);
        }
      }

      // Kill any stuck Helm operations
      console.log('🔄 Checking for stuck Helm operations...');
      try {
        // Get all Helm releases and check for pending/failed operations
        const { stdout: helmStatus } = await execPromise('helm list -A --pending --failed -o json');
        const pendingReleases = JSON.parse(helmStatus || '[]');

        for (const release of pendingReleases) {
          console.log(`⚠️ Found stuck release: ${release.name}, attempting to clean up...`);
          try {
            // Try to uninstall the stuck release directly
            await execPromise(`helm uninstall ${release.name} -n ${release.namespace} --timeout 30s`);
            console.log(`✅ Successfully uninstalled stuck release: ${release.name}`);
          } catch (uninstallError) {
            console.log(`🚫 Uninstall failed: ${uninstallError.message}`);
            // If uninstall fails, try to delete using kubectl directly
            try {
              console.log(`🔧 Attempting to remove Helm secret directly...`);
              await execPromise(`kubectl delete secret -n ${release.namespace} -l owner=helm,name=${release.name} --ignore-not-found=true`);
              console.log(`✅ Removed Helm secret for ${release.name}`);
            } catch (secretDeleteError) {
              console.log(`⚠️ Could not remove Helm secret: ${secretDeleteError.message}`);
            }
          }
        }

        // Also check for any remaining exam releases that might not show up in pending/failed
        const { stdout: allReleases } = await execPromise('helm list -A -o json');
        const allReleasesList = JSON.parse(allReleases || '[]');
        const remainingExamReleases = allReleasesList.filter(release =>
          release.name.match(/^(ckad|cka|cks|kcna)-(beginner|intermediate|advanced|easy|hard)$/)
        );

        for (const release of remainingExamReleases) {
          console.log(`🧹 Cleaning up remaining exam release: ${release.name}`);
          try {
            await execPromise(`helm uninstall ${release.name} -n ${release.namespace} --timeout 30s`);
            console.log(`✅ Successfully uninstalled: ${release.name}`);
          } catch (uninstallError) {
            console.log(`⚠️ Could not uninstall ${release.name}: ${uninstallError.message}`);
          }
        }

      } catch (statusError) {
        console.log(`ℹ️ No stuck Helm operations found: ${statusError.message}`);
      }

      console.log('✅ Cleanup completed successfully');
      return { success: true, message: 'Resources cleaned up successfully' };

    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      return { success: false, error: error.message };
    }
  }

  async applyChart(examType, difficulty, practiceMode = false) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    const chartId = `${examType}-${difficulty}${practiceMode ? '-practice' : ''}`;
    const chartPath = path.join(this.generatedChartsPath, chartId);
    const releaseName = chartId;
    const namespace = `k8s-exam-${examType}-${difficulty}`;

    try {
      // First check if chart directory exists
      await fs.access(chartPath);
      console.log(`Applying Helm chart from ${chartPath}`);

      // Clean up any existing exam resources first
      console.log('🧹 Performing cleanup before applying new chart...');
      await this.cleanupExamResources();

      // Wait a moment for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create namespace if it doesn't exist
      try {
        await execPromise(`kubectl create namespace ${namespace} --dry-run=client -o yaml | kubectl apply -f -`);
      } catch (nsError) {
        console.log(`Namespace ${namespace} already exists or cannot be created`);
      }

      // Apply the Helm chart with optimized settings (no --wait to avoid timeouts)
      const helmCommand = `helm upgrade --install ${releaseName} ${chartPath} --namespace ${namespace} --timeout 5m --force`;
      console.log(`Executing: ${helmCommand}`);

      const { stdout, stderr } = await execPromise(helmCommand);

      if (stderr && !stderr.includes('WARNING')) {
        console.error('Helm apply stderr:', stderr);
      }

      console.log('Helm apply stdout:', stdout);

      return {
        success: true,
        releaseName,
        namespace,
        output: stdout,
        message: `Helm chart ${releaseName} applied successfully to namespace ${namespace}`
      };
    } catch (error) {
      console.error('Error applying Helm chart:', error);

      // Try to get more details about the error
      let errorDetails = error.message;
      if (error.stderr) {
        errorDetails += `\nStderr: ${error.stderr}`;
      }
      if (error.stdout) {
        errorDetails += `\nStdout: ${error.stdout}`;
      }

      return {
        success: false,
        error: 'Failed to apply Helm chart',
        message: errorDetails,
        output: error.stdout || '',
        stderr: error.stderr || ''
      };
    }
  }

  async applyChartWithStreaming(examType, difficulty, sendSSE, practiceMode = false) {
    const { exec, spawn } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    const chartId = `${examType}-${difficulty}${practiceMode ? '-practice' : ''}`;
    const chartPath = path.join(this.generatedChartsPath, chartId);
    const releaseName = chartId;
    const namespace = `k8s-exam-${examType}-${difficulty}`;

    try {
      // First check if chart directory exists
      await fs.access(chartPath);
      sendSSE('progress', { message: '📦 Chart found, starting deployment process...' });

      sendSSE('progress', { message: '🧹 Performing cleanup before applying new chart...' });

      // Clean up any existing exam resources first with streaming output
      await this.cleanupExamResourcesWithStreaming(sendSSE);

      // Wait a moment for cleanup to complete
      sendSSE('progress', { message: '⏳ Waiting for cleanup to complete...' });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create namespace if it doesn't exist
      sendSSE('progress', { message: `🌍 Creating namespace ${namespace}...` });
      try {
        await execPromise(`kubectl create namespace ${namespace} --dry-run=client -o yaml | kubectl apply -f -`);
        sendSSE('progress', { message: `✅ Namespace ${namespace} ready` });
      } catch (nsError) {
        sendSSE('progress', { message: `ℹ️ Namespace ${namespace} already exists` });
      }

      // Apply the Helm chart with streaming output (without --wait to avoid timeouts)
      const helmCommand = `helm upgrade --install ${releaseName} ${chartPath} --namespace ${namespace} --timeout 5m --force`;
      sendSSE('progress', { message: `🚀 Applying Helm chart...` });
      sendSSE('progress', { message: `📝 Command: ${helmCommand}` });
      sendSSE('progress', { message: `ℹ️ Note: Resources will be created asynchronously, some may take time to become ready` });

      return new Promise((resolve, reject) => {
        const helmProcess = spawn('helm', [
          'upgrade', '--install', releaseName, chartPath,
          '--namespace', namespace,
          '--timeout', '5m', '--force'
        ], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        helmProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          // Send each line of output to the client
          const lines = output.split('\n').filter(line => line.trim());
          lines.forEach(line => {
            if (line.trim()) {
              sendSSE('progress', { message: `📄 ${line.trim()}` });
            }
          });
        });

        helmProcess.stderr.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          // Send stderr as warning messages
          const lines = output.split('\n').filter(line => line.trim());
          lines.forEach(line => {
            if (line.trim() && !line.includes('WARNING')) {
              sendSSE('progress', { message: `⚠️ ${line.trim()}` });
            }
          });
        });

        helmProcess.on('close', async (code) => {
          if (code === 0) {
            sendSSE('progress', { message: '✅ Helm chart applied successfully!' });

            // Verify deployment by checking created resources
            try {
              sendSSE('progress', { message: '🔍 Verifying resource creation...' });

              // Check namespaces
              const { stdout: nsOutput } = await execPromise('kubectl get namespaces --no-headers | wc -l');
              const namespaceCount = parseInt(nsOutput.trim());
              sendSSE('progress', { message: `📊 Found ${namespaceCount} namespaces in cluster` });

              // Check pods in planetary namespaces
              const planetaryNamespaces = ['saturn', 'venus', 'pluto', 'mars', 'mercury', 'jupiter', 'uranus', 'neptune'];
              let totalPods = 0;
              let runningPods = 0;

              for (const ns of planetaryNamespaces) {
                try {
                  const { stdout: podOutput } = await execPromise(`kubectl get pods -n ${ns} --no-headers 2>/dev/null || echo ""`);
                  if (podOutput.trim()) {
                    const pods = podOutput.trim().split('\n').filter(line => line.trim());
                    totalPods += pods.length;
                    const running = pods.filter(line => line.includes('Running')).length;
                    runningPods += running;
                    sendSSE('progress', { message: `📦 Namespace ${ns}: ${pods.length} pods (${running} running)` });
                  }
                } catch (error) {
                  // Namespace might not exist, which is fine
                }
              }

              sendSSE('progress', { message: `🎯 Total: ${totalPods} pods created (${runningPods} running, others may still be starting)` });
              sendSSE('progress', { message: '✅ Deployment verification completed - resources are being created' });

            } catch (verifyError) {
              sendSSE('progress', { message: `⚠️ Verification warning: ${verifyError.message}` });
            }

            resolve({
              success: true,
              releaseName,
              namespace,
              output: stdout,
              message: `Helm chart ${releaseName} applied successfully to namespace ${namespace}`
            });
          } else {
            sendSSE('progress', { message: `❌ Helm command failed with exit code ${code}` });
            reject({
              success: false,
              error: 'Failed to apply Helm chart',
              message: stderr || `Process exited with code ${code}`,
              output: stdout,
              stderr: stderr
            });
          }
        });

        helmProcess.on('error', (error) => {
          sendSSE('progress', { message: `❌ Process error: ${error.message}` });
          reject({
            success: false,
            error: 'Failed to start Helm process',
            message: error.message
          });
        });
      });

    } catch (error) {
      sendSSE('progress', { message: `❌ Error: ${error.message}` });
      throw {
        success: false,
        error: 'Failed to apply Helm chart',
        message: error.message,
        output: error.stdout || '',
        stderr: error.stderr || ''
      };
    }
  }

  async cleanupExamResourcesWithStreaming(sendSSE) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    sendSSE('progress', { message: '🧹 Cleaning up existing exam resources...' });

    try {
      // List all Helm releases that look like exam releases
      const { stdout: helmList } = await execPromise('helm list -A -o json');
      const releases = JSON.parse(helmList || '[]');
      const examReleases = releases.filter(release =>
        release.name.match(/^(ckad|cka|cks|kcna)-(beginner|intermediate|advanced|easy|hard)$/)
      );

      // Uninstall exam-related Helm releases
      for (const release of examReleases) {
        sendSSE('progress', { message: `📦 Uninstalling Helm release: ${release.name}` });
        try {
          await execPromise(`helm uninstall ${release.name} -n ${release.namespace} --wait --timeout 1m`);
          sendSSE('progress', { message: `✅ Successfully uninstalled ${release.name}` });
        } catch (uninstallError) {
          sendSSE('progress', { message: `⚠️ Could not uninstall ${release.name}` });
        }
      }

      // Clean up planetary namespaces and exam-related resources
      const planetaryNamespaces = ['saturn', 'venus', 'pluto', 'mars', 'mercury', 'jupiter', 'uranus', 'neptune'];
      const examNamespaces = ['k8s-exam-ckad', 'k8s-exam-cka', 'k8s-exam-cks', 'k8s-exam-kcna'];
      const allExamNamespaces = [...planetaryNamespaces, ...examNamespaces];

      for (const ns of allExamNamespaces) {
        try {
          // Check if namespace exists first
          await execPromise(`kubectl get namespace ${ns}`);
          sendSSE('progress', { message: `🌍 Deleting namespace: ${ns}` });
          await execPromise(`kubectl delete namespace ${ns} --ignore-not-found=true --timeout=60s`);
          sendSSE('progress', { message: `✅ Successfully deleted namespace ${ns}` });
        } catch (nsError) {
          // Namespace doesn't exist or couldn't be deleted, which is fine
          sendSSE('progress', { message: `ℹ️ Namespace ${ns} doesn't exist or already deleted` });
        }
      }

      // Kill any stuck Helm operations with streaming feedback
      sendSSE('progress', { message: '🔄 Checking for stuck Helm operations...' });
      try {
        // Get all Helm releases and check for pending/failed operations
        const { stdout: helmStatus } = await execPromise('helm list -A --pending --failed -o json');
        const pendingReleases = JSON.parse(helmStatus || '[]');

        for (const release of pendingReleases) {
          sendSSE('progress', { message: `⚠️ Found stuck release: ${release.name}, cleaning up...` });
          try {
            // Try to uninstall the stuck release directly
            await execPromise(`helm uninstall ${release.name} -n ${release.namespace} --timeout 30s`);
            sendSSE('progress', { message: `✅ Successfully uninstalled stuck release: ${release.name}` });
          } catch (uninstallError) {
            sendSSE('progress', { message: `🚫 Uninstall failed, trying direct secret cleanup...` });
            // If uninstall fails, try to delete using kubectl directly
            try {
              await execPromise(`kubectl delete secret -n ${release.namespace} -l owner=helm,name=${release.name} --ignore-not-found=true`);
              sendSSE('progress', { message: `✅ Removed Helm secret for ${release.name}` });
            } catch (secretDeleteError) {
              sendSSE('progress', { message: `⚠️ Could not remove Helm secret for ${release.name}` });
            }
          }
        }

        // Also check for any remaining exam releases that might not show up in pending/failed
        const { stdout: allReleases } = await execPromise('helm list -A -o json');
        const allReleasesList = JSON.parse(allReleases || '[]');
        const remainingExamReleases = allReleasesList.filter(release =>
          release.name.match(/^(ckad|cka|cks|kcna)-(beginner|intermediate|advanced|easy|hard)$/)
        );

        for (const release of remainingExamReleases) {
          sendSSE('progress', { message: `🧹 Cleaning up remaining exam release: ${release.name}` });
          try {
            await execPromise(`helm uninstall ${release.name} -n ${release.namespace} --timeout 30s`);
            sendSSE('progress', { message: `✅ Successfully uninstalled: ${release.name}` });
          } catch (uninstallError) {
            sendSSE('progress', { message: `⚠️ Could not uninstall ${release.name}` });
          }
        }

      } catch (statusError) {
        sendSSE('progress', { message: `ℹ️ No stuck Helm operations found` });
      }

      sendSSE('progress', { message: '✅ Cleanup completed successfully' });
      return { success: true, message: 'Resources cleaned up successfully' };

    } catch (error) {
      sendSSE('progress', { message: `❌ Error during cleanup: ${error.message}` });
      return { success: false, error: error.message };
    }
  }

  async checkChartStatus(examType, difficulty, practiceMode = false) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    const releaseName = `${examType}-${difficulty}${practiceMode ? '-practice' : ''}`;
    const namespace = `k8s-exam-${examType}-${difficulty}`;

    try {
      // Check if the release exists
      const { stdout } = await execPromise(`helm list -n ${namespace} --filter ${releaseName} -o json`);
      const releases = JSON.parse(stdout || '[]');

      if (releases.length > 0) {
        const release = releases[0];
        return {
          applied: true,
          releaseName: release.name,
          namespace: release.namespace,
          status: release.status,
          updated: release.updated,
          chart: release.chart,
          appVersion: release.app_version,
          message: `Helm release ${releaseName} is ${release.status}`
        };
      }

      return {
        applied: false,
        releaseName,
        namespace,
        status: 'not-found',
        nodes: [],
        message: 'Helm release not found in cluster'
      };
    } catch (error) {
      console.error('Error checking chart status:', error);
      return {
        applied: false,
        releaseName,
        namespace,
        status: 'error',
        nodes: [],
        message: `Error checking status: ${error.message}`
      };
    }
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
      // Also clear cache
      this.cache.clear();
      console.log('Generated charts and cache cleaned up successfully');
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