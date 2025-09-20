import React from 'react';
import CopyableValue from '../components/CopyableValue/CopyableValue';

interface ParsedSegment {
  type: 'text' | 'copyable';
  content: string;
}

export function parseQuestionText(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];

  // Simple markup-based parsing using ||value|| syntax
  const parts = text.split(/(\|\|[^|]+\|\|)/);

  parts.forEach(part => {
    if (part.startsWith('||') && part.endsWith('||')) {
      // This is a copyable value
      const value = part.slice(2, -2); // Remove the || markers
      segments.push({
        type: 'copyable',
        content: value
      });
    } else if (part.length > 0) {
      // This is regular text
      segments.push({
        type: 'text',
        content: part
      });
    }
  });

  // If no segments were created, return the entire text as a single segment
  if (segments.length === 0) {
    segments.push({
      type: 'text',
      content: text
    });
  }

  return segments;
}

// React component to render parsed question with copyable values
export function QuestionWithCopyables({ text }: { text: string }) {
  const segments = parseQuestionText(text);

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'copyable') {
          return <CopyableValue key={index} value={segment.content} />;
        }
        return <span key={index}>{segment.content}</span>;
      })}
    </>
  );
}