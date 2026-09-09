export interface TranscriptItem {
  speaker: string;
  text: string;
  startTime?: number;
  endTime?: number;
}

interface TranscriptSegment {
  speaker?: string;
  speaker_id?: string;
  user?: { name?: string; id?: string } | string;
  name?: string;
  text?: string;
  content?: string;
  words?: Array<{ word?: string; text?: string; start_time?: number; end_time?: number }>;
  start_time?: number | string;
  end_time?: number | string;
}

function parseTimestampToSeconds(ts: string): number | undefined {
  const parts = ts.trim().split(":");
  if (parts.length === 2) {
    const min = parseFloat(parts[0]);
    const sec = parseFloat(parts[1]);
    if (!isNaN(min) && !isNaN(sec)) return min * 60 + sec;
  } else if (parts.length === 3) {
    const hr = parseFloat(parts[0]);
    const min = parseFloat(parts[1]);
    const sec = parseFloat(parts[2]);
    if (!isNaN(hr) && !isNaN(min) && !isNaN(sec)) return hr * 3600 + min * 60 + sec;
  }
  return undefined;
}

function parseTime(val: unknown): number | undefined {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const num = parseFloat(val);
    if (!isNaN(num)) return num;
    return parseTimestampToSeconds(val);
  }
  return undefined;
}

function resolveSpeakerName(raw: string, speakerMap?: Record<string, string>): string {
  if (!speakerMap || !raw) return raw || "Speaker";

  // 1. Direct match
  if (speakerMap[raw]) return speakerMap[raw];

  const lowerRaw = raw.toLowerCase().trim();

  // 2. Exact case-insensitive match
  for (const [id, name] of Object.entries(speakerMap)) {
    if (id.toLowerCase() === lowerRaw) return name;
  }

  // 3. Substring match (e.g. participant ID contains user ID or agent ID)
  for (const [id, name] of Object.entries(speakerMap)) {
    if (id && id.length > 5 && lowerRaw.includes(id.toLowerCase())) {
      return name;
    }
  }

  // 4. Keyword heuristics
  if (lowerRaw.includes("agent") || lowerRaw.includes("assistant") || lowerRaw.includes("bot") || lowerRaw.includes("ai")) {
    for (const [id, name] of Object.entries(speakerMap)) {
      if (id.startsWith("agent:") || lowerRaw.includes(name.toLowerCase())) return name;
    }
  }

  return raw;
}

function formatSpeakerName(item: TranscriptSegment, speakerMap?: Record<string, string>): string {
  let raw = "";
  if (typeof item.user === "object" && item.user?.name) {
    raw = item.user.name;
  } else if (typeof item.user === "object" && item.user?.id) {
    raw = item.user.id;
  } else if (typeof item.user === "string") {
    raw = item.user;
  } else {
    raw = item.speaker || item.speaker_id || item.name || "Speaker";
  }

  return resolveSpeakerName(raw, speakerMap);
}

function formatSegmentText(item: TranscriptSegment): string {
  if (item.text) return item.text.trim();
  if (item.content) return item.content.trim();
  if (Array.isArray(item.words)) {
    return item.words
      .map((w) => w.word || w.text || "")
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  return "";
}

export function parseTranscriptItems(
  rawText: string,
  speakerMap?: Record<string, string>
): TranscriptItem[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // 1. Try parsing as a single JSON payload
  try {
    const parsed = JSON.parse(trimmed);

    // Array of segments
    if (Array.isArray(parsed)) {
      const items = parsed
        .map((item: TranscriptSegment): TranscriptItem | null => {
          const speaker = formatSpeakerName(item, speakerMap);
          const text = formatSegmentText(item);
          if (!text) return null;
          return {
            speaker,
            text,
            startTime: parseTime(item.start_time),
            endTime: parseTime(item.end_time),
          };
        })
        .filter((item): item is TranscriptItem => item !== null);

      if (items.length > 0) return items;
    }

    // Object with segments or results
    if (parsed && typeof parsed === "object") {
      const segments: TranscriptSegment[] =
        parsed.segments ||
        parsed.transcription ||
        parsed.results ||
        parsed.items ||
        [];

      if (Array.isArray(segments) && segments.length > 0) {
        const items = segments
          .map((item: TranscriptSegment): TranscriptItem | null => {
            const speaker = formatSpeakerName(item, speakerMap);
            const text = formatSegmentText(item);
            if (!text) return null;
            return {
              speaker,
              text,
              startTime: parseTime(item.start_time),
              endTime: parseTime(item.end_time),
            };
          })
          .filter((item): item is TranscriptItem => item !== null);

        if (items.length > 0) return items;
      }

      if (parsed.text && typeof parsed.text === "string" && parsed.text.trim()) {
        return [{ speaker: resolveSpeakerName("Speaker", speakerMap), text: parsed.text.trim() }];
      }
    }
  } catch {
    // Not valid single JSON
  }

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 2. Try parsing as JSON Lines (JSONL)
  const jsonlItems: TranscriptItem[] = [];
  let jsonlCount = 0;

  for (const line of lines) {
    if (line.startsWith("{") && line.endsWith("}")) {
      try {
        const item: TranscriptSegment = JSON.parse(line);
        const speaker = formatSpeakerName(item, speakerMap);
        const text = formatSegmentText(item);
        if (text) {
          jsonlItems.push({
            speaker,
            text,
            startTime: parseTime(item.start_time),
            endTime: parseTime(item.end_time),
          });
          jsonlCount++;
        }
      } catch {
        // Skip
      }
    }
  }

  if (jsonlCount > 0 && jsonlItems.length > 0) {
    return jsonlItems;
  }

  // 3. Try parsing WebVTT / SRT format
  if (trimmed.startsWith("WEBVTT") || /-->/.test(trimmed)) {
    const vttItems: TranscriptItem[] = [];
    let currentStart: number | undefined;
    let currentEnd: number | undefined;
    let currentSpeaker = resolveSpeakerName("Speaker", speakerMap);

    for (const rawLine of lines) {
      // Header or note
      if (rawLine.startsWith("WEBVTT") || rawLine.startsWith("NOTE") || /^\d+$/.test(rawLine)) {
        continue;
      }

      // Timestamp line: 00:00:01.000 --> 00:00:04.000
      if (rawLine.includes("-->")) {
        const [startPart, endPart] = rawLine.split("-->");
        currentStart = parseTimestampToSeconds(startPart.split(" ")[0]);
        currentEnd = parseTimestampToSeconds(endPart.trim().split(" ")[0]);
        continue;
      }

      // Voice tag match
      const voiceMatch =
        rawLine.match(/<v\s+([^>]+)>(.*?)<\/v>/i) ||
        rawLine.match(/<v\s+([^>]+)>(.*)/i);
      if (voiceMatch) {
        currentSpeaker = resolveSpeakerName(voiceMatch[1].trim(), speakerMap);
        const text = voiceMatch[2].replace(/<[^>]+>/g, "").trim();
        if (text) {
          vttItems.push({
            speaker: currentSpeaker,
            text,
            startTime: currentStart,
            endTime: currentEnd,
          });
        }
      } else {
        const cleanLine = rawLine.replace(/<[^>]+>/g, "").trim();
        if (cleanLine) {
          vttItems.push({
            speaker: currentSpeaker,
            text: cleanLine,
            startTime: currentStart,
            endTime: currentEnd,
          });
        }
      }
    }

    if (vttItems.length > 0) {
      return vttItems;
    }
  }

  // 4. Fallback: Parse plain text lines
  const plainItems: TranscriptItem[] = [];
  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0 && colonIndex < 30) {
      const rawSpeaker = line.slice(0, colonIndex).trim();
      const speaker = resolveSpeakerName(rawSpeaker, speakerMap);
      const text = line.slice(colonIndex + 1).trim();
      if (text) {
        plainItems.push({ speaker, text });
        continue;
      }
    }
    plainItems.push({ speaker: resolveSpeakerName("Speaker", speakerMap), text: line });
  }

  return plainItems;
}
