import {
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from './client';

const googleProvider = new GoogleAuthProvider();

/**
 * Google 로그인
 */
export async function signInWithGoogle() {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized');
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google 로그인 실패:', error);
    throw error;
  }
}

/**
 * 로그아웃
 */
export async function signOut() {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized');
  }
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('로그아웃 실패:', error);
    throw error;
  }
}

/**
 * Auth 상태 변화 감지
 */
export function onAuthStateChange(callback: (user: FirebaseUser | null) => void) {
  if (!auth) {
    // Firebase가 초기화되지 않았으면 즉시 null 콜백
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

/**
 * 현재 로그인된 사용자 가져오기
 */
export function getCurrentUser(): FirebaseUser | null {
  return auth?.currentUser || null;
}
