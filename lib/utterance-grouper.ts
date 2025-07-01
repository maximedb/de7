import { Utterance } from './types';

export function groupUtterances(utterances: Utterance[]): Utterance[] {
  if (!utterances || utterances.length === 0) {
    return utterances;
  }

  const grouped: Utterance[] = [];
  let currentGroup: Utterance | null = null;

  for (let i = 0; i < utterances.length; i++) {
    const utterance = utterances[i];
    
    if (currentGroup === null) {
      currentGroup = { ...utterance };
      continue;
    }

    const shouldGroup = shouldGroupWithPrevious(currentGroup, utterance);
    
    if (shouldGroup) {
      // Merge current utterance with the group
      currentGroup = mergeUtterances(currentGroup, utterance);
    } else {
      // Finalize current group and start new one
      grouped.push(currentGroup);
      currentGroup = { ...utterance };
    }
  }

  // Don't forget the last group
  if (currentGroup !== null) {
    grouped.push(currentGroup);
  }

  return grouped;
}

function shouldGroupWithPrevious(previous: Utterance, current: Utterance): boolean {
  const previousText = previous.text.trim();
  const currentText = current.text.trim();
  
  if (!previousText || !currentText) {
    return false;
  }

  // Check time gap between utterances (must be less than 1 second)
  const timeGap = current.start - previous.end;
  if (timeGap >= 1.0) {
    return false;
  }

  // Check if previous utterance doesn't end with sentence-ending punctuation
  const endsWithSentencePunctuation = /[.!?]$/.test(previousText);
  
  // Check if current utterance doesn't start with capital letter
  const startsWithCapital = /^[A-Z]/.test(currentText);
  
  // Group if previous doesn't end with sentence-ending punctuation AND current doesn't start with capital AND gap < 1s
  return !endsWithSentencePunctuation && !startsWithCapital;
}

function mergeUtterances(first: Utterance, second: Utterance): Utterance {
  return {
    text: `${first.text} ${second.text}`,
    start: first.start,
    end: second.end,
    confidence: Math.min(first.confidence, second.confidence), // Use lower confidence
    speaker: first.speaker, // Keep first speaker
    words: [...first.words, ...second.words],
    translation: first.translation // Keep existing translation if any
  };
}