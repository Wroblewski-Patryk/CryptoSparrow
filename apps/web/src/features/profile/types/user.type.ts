export type User = {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  uiPreferences?: {
    tableColumnVisibility?: Record<string, Record<string, boolean>>;
  };
  createdAt: Date;
  updatedAt: Date;
};
