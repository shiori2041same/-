/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  username: string;
}

export interface Achievement {
  id: string;
  userId: string;
  text: string;
  date: string; // "YYYY-MM-DD"
  createdAt: number;
}

export interface Template {
  id: string;
  userId: string; // "system" or standard userId
  text: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export type ActiveTab = 'add' | 'list' | 'templates' | 'review' | 'account';
