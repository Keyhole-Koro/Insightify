import React from "react";
import type { ProjectSummary } from "@insightify/desktop-bridge";

interface ProjectRailProps {
  projects: ProjectSummary[];
  selectedProject: ProjectSummary | null;
  busy: boolean;
  onPick: () => void;
  onSelect: (project: ProjectSummary) => void;
}

export function ProjectRail({
  projects,
  selectedProject,
  busy,
  onPick,
  onSelect,
}: ProjectRailProps) {
  return (
    <aside className="project-rail" aria-label="Project switcher">
      <div className="brand-mark" aria-label="Insightify">
        I
      </div>
      <button
        className="rail-action"
        onClick={onPick}
        title="Open project"
        type="button"
        aria-label="Open project"
      >
        ＋
      </button>
      <div className="project-list">
        {projects.map((item) => (
          <button
            className={item.id === selectedProject?.id ? "project-chip selected" : "project-chip"}
            key={item.id}
            disabled={busy}
            onClick={() => onSelect(item)}
            title={item.displayName}
            type="button"
          >
            {item.displayName.slice(0, 2).toUpperCase()}
          </button>
        ))}
      </div>
    </aside>
  );
}
