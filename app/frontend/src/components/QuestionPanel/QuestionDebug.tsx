import React from 'react';
import { parseQuestionText } from '../../utils/questionParser';

// Debug component to test question parsing (can be removed later)
const QuestionDebug: React.FC = () => {
  const testQuestions = [
    // Test questions with explicit markup
    "Create a CronJob named ||daily-job|| that runs every day at midnight using image ||busybox:1.31.0|| and command ||echo Hello World||.",
    "Create a Pod named ||restart-pod|| using image ||busybox:1.31.0|| with restart policy ||Never|| and command ||echo hello && exit 1||.",
    "Create a file ||/tmp/app.conf|| with content ||server.port=8080|| and create a ConfigMap named ||file-config|| from this file.",
    "Create a Secret named ||db-secret|| with username ||admin|| and password ||secret123||.",
    "Create a ConfigMap named ||app-config|| with key ||database_url|| and value ||mysql://localhost:3306/mydb||.",

    // Fixed problematic questions with explicit markup:
    "Get Pods with Specific Label. List all pods in the ||pluto|| namespace that have the label ||app=web|| and save the output to ||/opt/course/27/labeled-pods.txt||.",
    "Create Pod with Environment Variables from ConfigMap. Create a Pod named ||env-pod|| using image ||busybox:1.31.0|| that gets the ||database_url|| from the ||app-config|| ConfigMap as an environment variable named ||DB_URL|| in the ||saturn|| namespace.",
    "Create Pod with Security Context. Create a Pod named ||secure-pod|| using image ||nginx:1.20-alpine|| that runs as user ID ||1000|| and group ID ||2000|| in the ||pluto|| namespace.",

    // Fixed new problematic questions with explicit markup:
    "Create Pod with InitContainer. Create a Pod named ||init-pod|| with an init container that runs ||busybox:1.31.0|| with command ||echo Init complete|| and a main container running ||nginx:1.20-alpine|| in the ||venus|| namespace.",
    "Create a ReplicaSet named ||rs-test|| with ||3|| replicas using image ||nginx:1.20-alpine|| and labels ||app=rs-test|| in the ||mars|| namespace.",

    // Additional test cases with markup
    "Create Pod with Secret as Volume. Create a Pod named ||secret-vol-pod|| using image ||nginx:1.20-alpine|| that mounts the ||db-secret|| as a volume at ||/etc/secrets|| in the ||venus|| namespace.",
    "Get the list of all Namespaces in the cluster and save it to ||/opt/course/1/namespaces||.",
    "Rollback a Deployment. Rollback the ||web-deploy|| Deployment to the previous revision.",
    "Get All Resources in Namespace. List all resources in the ||default|| namespace and save the output to ||/opt/course/37/all-resources.txt||."
  ];

  return (
    <div className="p-4 bg-gray-100">
      <h3 className="text-lg font-bold mb-4">Question Parser Debug</h3>
      {testQuestions.map((question, index) => {
        const segments = parseQuestionText(question);
        const copyableValues = segments.filter(s => s.type === 'copyable').map(s => s.content);

        return (
          <div key={index} className="mb-4 p-3 bg-white rounded">
            <p className="text-sm text-gray-600 mb-2">Question {index + 1}:</p>
            <p className="mb-2">{question}</p>
            <p className="text-sm text-blue-600">
              Copyable values found: {copyableValues.length > 0 ? copyableValues.join(', ') : 'None'}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default QuestionDebug;