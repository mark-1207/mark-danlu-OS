export interface ProjectMemory {
  projectId: string;
  indexPath: string;
  lastUpdated: string;
  summary: string;           // one-paragraph summary for quick loading
  pendingTasks: string[];
  recentConclusions: string[];
  userPreferences: UserPreference[];
}

export interface GlobalMemory {
  path: string;
  communicationStyle: string;
  contentStylePreference: string;
  preferences: Record<string, string>;
}

export interface UserPreference {
  key: string;
  value: string;
  description: string;
}

export interface MemoryLoadResult {
  globalMemory: GlobalMemory | null;
  projectMemory: ProjectMemory | null;
  newCasesFound: string[];   // new style library cases
}

export interface MemorySection {
  title: string;
  content: string;
}
