#!/usr/bin/env python3

import json
import os
import glob
import re

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
QUESTION_BANK = os.path.join(SCRIPT_DIR, "question-bank")
NAMESPACES = ["saturn", "venus", "pluto", "mars", "mercury", "jupiter", "uranus", "neptune"]

def get_namespace(question_num):
    """Get namespace based on question number modulo 8"""
    return NAMESPACES[question_num % 8]

def fix_question_file(file_path):
    """Fix a single question file for namespace consistency"""
    try:
        with open(file_path, 'r') as f:
            question = json.load(f)

        # Extract question number from filename
        filename = os.path.basename(file_path)
        match = re.search(r'(\d+)', filename)
        if not match:
            print(f"Could not extract question number from {filename}")
            return False

        question_num = int(match.group(1))
        assigned_namespace = get_namespace(question_num)

        # Update infrastructure namespace
        if 'infrastructure' in question and 'namespaces' in question['infrastructure']:
            # Only update if there's exactly one namespace and it's one of the planetary ones
            current_namespaces = question['infrastructure']['namespaces']
            if len(current_namespaces) == 1 and current_namespaces[0] in NAMESPACES + ['']:
                question['infrastructure']['namespaces'] = [assigned_namespace]

        # Update description to use the assigned namespace
        if 'description' in question:
            # Replace any reference to planetary namespaces with the assigned one
            description = question['description']
            for old_ns in NAMESPACES:
                if old_ns != assigned_namespace:
                    description = re.sub(r'\|\|' + old_ns + r'\|\|', f'||{assigned_namespace}||', description)
            question['description'] = description

        # Update solution steps
        if 'solution' in question and 'steps' in question['solution']:
            updated_steps = []
            for step in question['solution']['steps']:
                # Replace namespace references in kubectl commands
                for old_ns in NAMESPACES:
                    if old_ns != assigned_namespace:
                        step = re.sub(r'-n\s+' + old_ns + r'\b', f'-n {assigned_namespace}', step)
                        step = re.sub(r'--namespace\s+' + old_ns + r'\b', f'--namespace {assigned_namespace}', step)
                updated_steps.append(step)
            question['solution']['steps'] = updated_steps

        # Update validation commands
        if 'validations' in question:
            updated_validations = []
            for validation in question['validations']:
                if 'command' in validation:
                    command = validation['command']
                    # Replace namespace references in kubectl commands
                    for old_ns in NAMESPACES:
                        if old_ns != assigned_namespace:
                            command = re.sub(r'-n\s+' + old_ns + r'\b', f'-n {assigned_namespace}', command)
                            command = re.sub(r'--namespace\s+' + old_ns + r'\b', f'--namespace {assigned_namespace}', command)
                    validation['command'] = command
                updated_validations.append(validation)
            question['validations'] = updated_validations

        # Write back the updated file
        with open(file_path, 'w') as f:
            json.dump(question, f, indent=2)

        print(f"✅ Updated {filename}: assigned namespace '{assigned_namespace}'")
        return True

    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        return False

def main():
    print("🔧 Fixing namespace consistency in question bank...")

    total_files = 0
    updated_files = 0

    # Process all question files
    for root, dirs, files in os.walk(QUESTION_BANK):
        for file in files:
            if file.endswith('.json'):
                file_path = os.path.join(root, file)
                total_files += 1
                if fix_question_file(file_path):
                    updated_files += 1

    print(f"\n📊 Summary:")
    print(f"  Total files processed: {total_files}")
    print(f"  Successfully updated: {updated_files}")
    print(f"  Failed: {total_files - updated_files}")

    print(f"\n🌍 Namespace assignment pattern:")
    for i, namespace in enumerate(NAMESPACES):
        examples = [str(i + j * 8) for j in range(3)]  # Show first 3 examples
        print(f"  {namespace}: questions {', '.join(examples)}, ...")

if __name__ == '__main__':
    main()