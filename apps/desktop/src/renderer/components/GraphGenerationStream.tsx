import React from "react";
import { extractStreamValues } from "../lib/flowfold-helpers.js";

interface GraphGenerationStreamProps {
  transcript: string;
  expansion: boolean;
  readingFiles?: string[];
}

export function GraphGenerationStream({
  transcript,
  expansion,
  readingFiles = [],
}: GraphGenerationStreamProps) {
  const titles = extractStreamValues(transcript, "title").slice(0, 8);
  const tail = transcript.slice(-900);

  return (
    <div className="graph-stream">
      <header>
        <span>LIVE STRUCTURED STREAM</span>
        <b>{transcript.length > 0 ? `${transcript.length.toLocaleString()} chars` : "Thinking…"}</b>
      </header>

      {/* Inspected/Read Files Section */}
      {readingFiles.length > 0 && (
        <div className="stream-reading-files">
          <div className="stream-section-title">
            <span>INSPECTED SOURCE FILES</span>
            <em>{readingFiles.length} files scanned</em>
          </div>
          <div className="stream-file-chips">
            {readingFiles.map((path) => (
              <span className="stream-file-chip" key={path} title={path}>
                <span className="file-icon">📄</span>
                <span className="file-name">{path}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {titles.length > 0 && (
        <div className="stream-discoveries">
          {titles.map((title, index) => (
            <span key={`${title}-${index}`}>
              <i />
              {!expansion && index === 0 ? `Graph · ${title}` : `Node · ${title}`}
            </span>
          ))}
        </div>
      )}
      <pre>
        {tail || (
          <span style={{ color: "#8b92a4", fontStyle: "italic" }}>
            ✦ Analyzing code snapshot and synthesizing FlowFold nodes… (structured generation in progress)
          </span>
        )}
        <i className="stream-cursor" />
      </pre>
    </div>
  );
}
