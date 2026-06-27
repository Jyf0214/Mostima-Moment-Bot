/**
 * Dashboard 共享类型定义
 */

export interface User {
  githubId: number;
  githubLogin: string;
  avatarUrl: string;
  isAdmin: boolean;
}

export interface Installation {
  installationId: number;
  accountLogin: string;
  accountType: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Repo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  updated_at: string;
  enabled: boolean;
  owner: {
    login: string;
    type: string;
    avatar_url: string;
  };
}

export interface ReposData {
  personal: Repo[];
  organization: Repo[];
  installations: Installation[];
}
