import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectSummary } from "@insightify/desktop-bridge";
import type { GeneratedFlowGraph } from "@insightify/graph-domain";
import { useBridge } from "../lib/bridge.js";

type ProjectGraphOptions = {
  onError: (reason: unknown) => void;
};

export type GraphUpdate = (current: GeneratedFlowGraph) => GeneratedFlowGraph;

export type ProjectGraphStore = {
  projects: ProjectSummary[];
  project: ProjectSummary | null;
  graph: GeneratedFlowGraph | null;
  graphLoading: boolean;
  /** Reads the newest graph synchronously, for pointer handlers that cannot wait for a render. */
  currentGraph: () => GeneratedFlowGraph | null;
  /** Opens the picker and registers the choice. Returns null when cancelled. */
  pickProject: () => Promise<ProjectSummary | null>;
  selectProject: (selected: ProjectSummary) => void;
  /** Accepts a generated graph, ignoring one that arrives for a project the user has left. */
  receiveGraph: (value: GeneratedFlowGraph) => boolean;
  /** Applies an edit and writes it back to disk. */
  editGraph: (update: GraphUpdate) => void;
  /** Applies an edit without saving — for the frames of a drag. */
  previewEdit: (update: GraphUpdate) => void;
  /** Saves whatever previewEdit left in memory — for the end of a drag. */
  commitPreview: () => void;
};

export function useProjectGraph(options: ProjectGraphOptions): ProjectGraphStore {
  const bridge = useBridge();
  const { onError } = options;
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [graph, setGraphState] = useState<GeneratedFlowGraph | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const projectIdRef = useRef<string | null>(null);
  const graphRef = useRef<GeneratedFlowGraph | null>(null);
  // Saves are serialized: a drag can outrun a write, and the last position must win.
  const saveQueue = useRef(Promise.resolve());

  const setGraph = useCallback((value: GeneratedFlowGraph | null) => {
    graphRef.current = value;
    setGraphState(value);
  }, []);

  const loadGraph = useCallback(
    async (projectId: string) => {
      setGraphLoading(true);
      try {
        const value = await bridge.getProjectGraph(projectId);
        if (projectIdRef.current === projectId) setGraph(value);
      } catch (reason) {
        onError(reason);
      } finally {
        if (projectIdRef.current === projectId) setGraphLoading(false);
      }
    },
    [bridge, onError, setGraph]
  );

  useEffect(() => {
    void bridge
      .listProjects()
      .then((knownProjects) => {
        setProjects(knownProjects);
        const initial = knownProjects[0] ?? null;
        setProject(initial);
        projectIdRef.current = initial?.id ?? null;
        if (initial) void loadGraph(initial.id);
      })
      .catch(onError);
  }, [bridge, loadGraph, onError]);

  const selectProject = useCallback(
    (selected: ProjectSummary) => {
      projectIdRef.current = selected.id;
      setProject(selected);
      setGraph(null);
      void loadGraph(selected.id);
    },
    [loadGraph, setGraph]
  );

  const pickProject = useCallback(async () => {
    try {
      const selected = await bridge.pickProject();
      if (!selected) return null;
      setProjects((current) => [selected, ...current.filter((item) => item.id !== selected.id)]);
      return selected;
    } catch (reason) {
      onError(reason);
      return null;
    }
  }, [bridge, onError]);

  const persistGraph = useCallback(
    (value: GeneratedFlowGraph) => {
      setGraph(value);
      saveQueue.current = saveQueue.current
        .then(async () => {
          await bridge.saveProjectGraph(value);
        })
        .catch(onError);
    },
    [bridge, onError, setGraph]
  );

  const receiveGraph = useCallback(
    (value: GeneratedFlowGraph) => {
      if (value.projectId !== projectIdRef.current) return false;
      setGraph(value);
      return true;
    },
    [setGraph]
  );

  const editGraph = useCallback(
    (update: GraphUpdate) => {
      const current = graphRef.current;
      if (current) persistGraph(update(current));
    },
    [persistGraph]
  );

  const previewEdit = useCallback(
    (update: GraphUpdate) => {
      const current = graphRef.current;
      if (current) setGraph(update(current));
    },
    [setGraph]
  );

  const commitPreview = useCallback(() => {
    if (graphRef.current) persistGraph(graphRef.current);
  }, [persistGraph]);

  return {
    projects,
    project,
    graph,
    graphLoading,
    currentGraph: () => graphRef.current,
    pickProject,
    selectProject,
    receiveGraph,
    editGraph,
    previewEdit,
    commitPreview,
  };
}
