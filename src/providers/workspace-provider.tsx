import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Workspace } from '@/types/workspace';

const STORAGE_KEY = 'activeWorkspace'

function readFromStorage(): Workspace | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Workspace) : null
  } catch {
    return null
  }
}

interface WorkspaceContextType {
  activeWorkspace: Workspace | null
  setActiveWorkspace: (workspace: Workspace | null) => void
  workspaces: Workspace[]
  setWorkspaces: (workspaces: Workspace[]) => void
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(readFromStorage)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])

  const setActiveWorkspace = useCallback((workspace: Workspace | null) => {
    setActiveWorkspaceState(workspace)
    try {
      if (workspace) localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }, [])

  return (
    <WorkspaceContext.Provider value={{
      activeWorkspace,
      setActiveWorkspace,
      workspaces,
      setWorkspaces
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}