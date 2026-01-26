'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChange } from '@/lib/firebase/auth';
import { getUserProfile, createUserProfile } from '@/lib/firebase/user';
import { User } from '@/types';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Firestore에서 사용자 프로필 가져오기
  const loadUserProfile = async (fbUser: FirebaseUser) => {
    try {
      const profile = await getUserProfile(fbUser.uid);

      if (!profile) {
        // users/{uid} 문서가 없으면 생성 (최초 로그인)
        await createUserProfile(fbUser.uid, fbUser.email || '');

        // 다시 가져오기
        const newProfile = await getUserProfile(fbUser.uid);
        setUser(newProfile);
      } else {
        setUser(profile);
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
      setUser(null);
    }
  };

  // 사용자 프로필 새로고침 (닉네임 설정 후 등)
  const refreshUser = async () => {
    if (firebaseUser) {
      await loadUserProfile(firebaseUser);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        await loadUserProfile(fbUser);
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// 편의 훅: 로그인 여부만 확인
export function useRequireAuth() {
  const { firebaseUser, loading } = useAuth();
  return { isAuthenticated: !!firebaseUser, loading };
}

// 편의 훅: role 확인
export function useUserRole() {
  const { user, loading } = useAuth();
  return {
    role: user?.role || 'guest',
    isOwner: user?.role === 'owner',
    isMember: user?.role === 'member',
    isPending: user?.role === 'pending',
    isGuest: !user,
    loading,
  };
}
