# Scoring Validators

This directory contains validation scripts for automatic scoring of exam answers.

## Structure

- `pod-validator.js` - Validates pod configurations and deployments
- `service-validator.js` - Validates service configurations  
- `configmap-validator.js` - Validates ConfigMap and Secret resources
- `deployment-validator.js` - Validates Deployment configurations

Each validator exports functions that check specific Kubernetes resources against expected criteria.
