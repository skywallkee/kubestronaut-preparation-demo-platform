# CKAD Subcategory Tags

Simple tagging system based on the main subcategories from each CKAD exam category.

---

## 1. Application Design and Build (20%)

- `container-images`
- `jobs-cronjobs`
- `multi-container-pods`

---

## 2. Application Deployment (20%)

- `deployments-rolling-updates`
- `application-scaling`
- `helm-package-manager`

---

## 3. Application Observability and Maintenance (15%)

- `health-probes`
- `logging-monitoring`
- `debugging-troubleshooting`

---

## 4. Application Environment, Configuration and Security (25%)

- `configmaps-secrets`
- `security-contexts`
- `resource-management`
- `service-accounts-rbac`

---

## 5. Services and Networking (20%)

- `services`
- `ingress`
- `network-policies`
- `dns-service-discovery`

---

## 6. Storage (10%)

- `persistent-volumes-claims`
- `storage-classes`
- `volume-types`

---

## Complete Tag List (18 tags total)

### Application Design and Build
1. `container-images`
2. `jobs-cronjobs`
3. `multi-container-pods`

### Application Deployment
4. `deployments-rolling-updates`
5. `application-scaling`
6. `helm-package-manager`

### Application Observability and Maintenance
7. `health-probes`
8. `logging-monitoring`
9. `debugging-troubleshooting`

### Application Environment, Configuration and Security
10. `configmaps-secrets`
11. `security-contexts`
12. `resource-management`
13. `service-accounts-rbac`

### Services and Networking
14. `services`
15. `ingress`
16. `network-policies`
17. `dns-service-discovery`

### Storage
18. `persistent-volumes-claims`
19. `storage-classes`
20. `volume-types`

---

## Usage Examples

```json
{
  "title": "Create Pod with Liveness Probe",
  "tags": ["health-probes"]
}
```

```json
{
  "title": "Scale Deployment",
  "tags": ["application-scaling"]
}
```

```json
{
  "title": "Create ConfigMap and Mount to Pod",
  "tags": ["configmaps-secrets"]
}
```

```json
{
  "title": "Multi-container Pod with Sidecar",
  "tags": ["multi-container-pods"]
}
```

```json
{
  "title": "Expose Deployment with NodePort Service",
  "tags": ["services"]
}
```