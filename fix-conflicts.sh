#!/bin/bash

# Script to fix resource conflicts in question bank
# This assigns unique namespaces and file paths to each question

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUESTION_BANK="$SCRIPT_DIR/question-bank"
NAMESPACES=("saturn" "venus" "pluto" "mars" "mercury" "jupiter" "uranus" "neptune")

echo "🔍 Fixing question conflicts..."

# Function to assign namespace based on question number
get_namespace() {
    local question_num=$1
    local namespace_index=$((question_num % 8))
    echo "${NAMESPACES[$namespace_index]}"
}

# Function to get unique file path based on question number
get_file_path() {
    local question_num=$1
    echo "/opt/course/$question_num"
}

# Process CKAD questions
echo "📝 Processing CKAD questions..."
for difficulty in easy intermediate advanced; do
    if [ -d "$QUESTION_BANK/ckad/$difficulty" ]; then
        for file in "$QUESTION_BANK/ckad/$difficulty"/*.json; do
            if [ -f "$file" ]; then
                # Extract question number from filename
                question_num=$(basename "$file" .json | grep -o '[0-9]\+')
                if [ -n "$question_num" ]; then
                    namespace=$(get_namespace $question_num)
                    file_path=$(get_file_path $question_num)

                    echo "  → Updating $(basename $file): namespace=$namespace, path=$file_path"

                    # Update namespace in infrastructure
                    jq --arg ns "$namespace" '.infrastructure.namespaces = [$ns]' "$file" > "$file.tmp" && mv "$file.tmp" "$file"

                    # Update file paths if they use /opt/course/
                    if grep -q "/opt/course/" "$file"; then
                        sed -i "s|/opt/course/[0-9]\+|$file_path|g" "$file"
                    fi
                fi
            fi
        done
    fi
done

# Process other exam types
for exam_type in cka cks kcna; do
    echo "📝 Processing $exam_type questions..."
    for difficulty in easy intermediate advanced beginner; do
        if [ -d "$QUESTION_BANK/$exam_type/$difficulty" ]; then
            for file in "$QUESTION_BANK/$exam_type/$difficulty"/*.json; do
                if [ -f "$file" ]; then
                    question_num=$(basename "$file" .json | grep -o '[0-9]\+')
                    if [ -n "$question_num" ]; then
                        namespace=$(get_namespace $question_num)
                        file_path=$(get_file_path $question_num)

                        echo "  → Updating $(basename $file): namespace=$namespace, path=$file_path"

                        # Update namespace in infrastructure
                        jq --arg ns "$namespace" '.infrastructure.namespaces = [$ns]' "$file" > "$file.tmp" && mv "$file.tmp" "$file"

                        # Update file paths
                        if grep -q "/opt/course/" "$file"; then
                            sed -i "s|/opt/course/[0-9]\+|$file_path|g" "$file"
                        fi
                    fi
                fi
            done
        fi
    done
done

echo "✅ Conflict resolution complete!"
echo "📊 Namespace distribution:"
for i in "${!NAMESPACES[@]}"; do
    echo "  ${NAMESPACES[$i]}: Questions ending in $i, $((i+8)), $((i+16)), etc."
done