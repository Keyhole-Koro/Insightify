import React from "react";
import { extractStreamValues } from "../lib/flowfold-helpers.js";

interface GraphGenerationStreamProps {
  transcript: string;
  expansion: boolean;
}

export function GraphGenerationStream({ transcript, expansion }: GraphGenerationStreamProps) {
  const titles = extractStreamValues(transcript, "title").slice(0, 8);
  const tail = transcript.slice(-900);

  return (
    <div className="graph-stream">
      <header>
        <span>LIVE STRUCTURED STREAM</span>
        <b>{transcript.length.toLocaleString()} chars</b>
      </header>
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
        {tail || "Waiting for the provider’s first structured output chunk…"}
        <i className="stream-cursor" />
      </pre>
    </div>
  );
}
