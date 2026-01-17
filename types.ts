export type FeedType = 'RSS' | 'YOUTUBE' | 'REDDIT' | 'PODCAST';

export interface Folder {
  id: string;
  name: string;
  updatedAt: number;
}

export interface Feed {
  id: string;
  folderId?: string;
  type: FeedType;
  title: string;
  url: string;
  siteUrl?: string;
  iconUrl?: string;
  unreadCount: number;
  lastFetched: number;
  error?: string;
  isRefreshing?: boolean;
}

export interface Article {
  id: string;
  feedId: string;
  title: string;
  url: string;
  author?: string;
  publishedAt: number;
  summary: string;
  content: string;
  read: boolean;
  bookmarked: boolean;
  enclosureUrl?: string;
  heroImage?: string;
  videoId?: string;
  mediaMetadata?: any;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
}

export interface AppSettings {
  baseUrl: string;
  refreshInterval: number; // minutes
  retentionDays: number;
  theme: 'light' | 'dark' | 'system';
  readerFontSize: 'sm' | 'base' | 'lg' | 'xl';
  readerFontFamily: 'sans' | 'serif';
}

export interface ActiveView {
  type: 'all' | 'folder' | 'feed' | 'smart' | 'search' | 'settings';
  id?: string;
  title: string;
}