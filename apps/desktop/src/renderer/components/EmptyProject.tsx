import React from "react";

interface EmptyProjectProps {
  onPick: () => void;
}

export function EmptyProject({ onPick }: EmptyProjectProps) {
  return (
    <div className="empty-project">
      <div className="empty-orbit" />
      <h1>Open a repository to enter its flow.</h1>
      <p>The path stays on this device. Insightify stores an opaque project id in the UI.</p>
      <button className="primary-button" onClick={onPick} type="button">
        Open project
      </button>
    </div>
  );
}
