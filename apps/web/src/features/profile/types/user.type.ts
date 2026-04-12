export type User = {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  uiPreferences?: {
    tableColumnVisibility?: Record<string, Record<string, boolean>>;
    timeZonePreference?: string;
  };
  createdAt: Date;
  updatedAt: Date;
};
