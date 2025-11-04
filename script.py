import os
import re
import json
from pathlib import Path

# ---------------------------
# CONFIGURATION
# ---------------------------
INPUT_DIR = "./CKAD-exercises"             # Directory with markdown files
OUTPUT_DIR = "./question-bank-intermediate"   # Output directory for JSON files
ID_PREFIX = "ckad-i-"
START_ID = 101
DEFAULT_POINTS = 6
DEFAULT_TIME = 10

# Map common resource keywords for detection
RESOURCE_MAP = {
    "pod": "pods",
    "pods": "pods",
    "deployment": "deployments",
    "deploy": "deployments",
    "configmap": "configmaps",
    "secret": "secrets",
    "service": "services",
    "svc": "services",
    "ingress": "ingresses",
    "namespace": "namespaces",
    "quota": "resourcequotas",
    "hpa": "horizontalpodautoscalers",
    "cronjob": "cronjobs",
    "job": "jobs",
    "pvc": "persistentvolumeclaims",
    "pv": "persistentvolumes"
}

# Infer category from filename
CATEGORY_MAP = {
    "a.core_concepts.md": "Core Concepts",
    "b.multi_container_pods.md": "Multi-Container Pods",
    "c.pod_design.md": "Pod Design",
    "d.configuration.md": "Configuration",
    "e.observability.md": "Observability",
    "f.services.md": "Services and Networking",
    "g.state.md": "State Persistence",
    "h.helm.md": "Helm",
    "i.crd.md": "Custom Resources",
    "j.podman.md": "Container Management"
}

# ---------------------------
# HELPERS
# ---------------------------
def detect_namespace(block):
    """Detect namespaces from text or commands"""
    namespaces = re.findall(r"-n\s+([a-z0-9-]+)", block)
    if not namespaces:
        namespaces = re.findall(r"namespace\s+([a-z0-9-]+)", block)
    return list(set(namespaces)) or ["default"]

def detect_resources(block):
    """Detect Kubernetes resources from command keywords"""
    found = set()
    for key, val in RESOURCE_MAP.items():
        if re.search(rf"\b{key}\b", block, re.IGNORECASE):
            found.add(val)
    return sorted(found)

def extract_kubectl_steps(block):
    """Extract kubectl commands as step list"""
    cmds = re.findall(r"```bash([\s\S]*?)```", block)
    steps = []
    for c in cmds:
        lines = [line.strip() for line in c.strip().split("\n") if line.strip()]
        for line in lines:
            if line.startswith("#"):  # skip comments
                continue
            steps.append(line)
    return steps

def create_json_obj(title, block, file_name, obj_id):
    """Create JSON object based on extracted details"""
    category = CATEGORY_MAP.get(file_name, "General")
    namespaces = detect_namespace(block)
    resources = detect_resources(block)
    steps = extract_kubectl_steps(block)

    tags = list(set(resources + namespaces))
    difficulty = "intermediate"

    obj = {
        "id": f"{ID_PREFIX}{obj_id}",
        "title": title.strip(),
        "description": title.strip(),
        "difficulty": difficulty,
        "category": category,
        "tags": tags,
        "points": DEFAULT_POINTS,
        "timeLimit": DEFAULT_TIME,
        "infrastructure": {
            "namespaces": namespaces,
            "resources": resources,
            "prerequisites": []
        },
        "solution": {
            "steps": [f"{i+1}. {step}" for i, step in enumerate(steps)]
        },
        "validations": [
            {
                "command": "echo OK",
                "expected": "OK",
                "points": 1,
                "description": "Placeholder validation"
            }
        ]
    }
    return obj

# ---------------------------
# MAIN LOGIC
# ---------------------------
def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    current_id = START_ID

    for md_file in sorted(Path(INPUT_DIR).glob("*.md")):
        with open(md_file, "r", encoding="utf-8") as f:
            text = f.read()

        # find each exercise section
        matches = list(re.finditer(r"### (.+)", text))
        for i, match in enumerate(matches):
            title = match.group(1)
            start = match.end()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            block = text[start:end]

            obj = create_json_obj(title, block, md_file.name, current_id)
            out_file = Path(OUTPUT_DIR) / f"{obj['id']}.json"
            with open(out_file, "w", encoding="utf-8") as out:
                json.dump(obj, out, indent=2)

            print(f"✅ Created {out_file.name}")
            current_id += 1

    print(f"\n🎉 Done! Generated {current_id - START_ID} JSON files in '{OUTPUT_DIR}/'")

if __name__ == "__main__":
    main()
