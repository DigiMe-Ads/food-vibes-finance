import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Project } from '@/types/types';
import { getDefaultProject } from '@/services/api';

interface ProjectContextType {
  project: Project | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setProject: (p: Project) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const p = await getDefaultProject();
    setProject(p);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  return (
    <ProjectContext.Provider value={{ project, loading, refresh, setProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
