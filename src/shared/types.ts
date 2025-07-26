export interface Session {
  id: string;
  name: string;
  projectId: string;
  createdAt: string;
  lastActiveAt: string;
  claudeSessionId?: string;
  isTemporary: boolean;
  isLoading?: boolean;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  sessions: Session[];
}

export interface ClaudeDetectionResult {
  isInstalled: boolean
  version?: string
  path?: string
  error?: string
  timestamp: number
}

export interface ClaudeChannelInfo {
  model: string
  apiBaseUrl?: string
  channelName?: string
  timestamp: number
}