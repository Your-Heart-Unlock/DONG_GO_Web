import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './client';
import { User, UserRole } from '@/types';

/**
 * users/{uid} 문서 가져오기
 */
export async function getUserProfile(uid: string): Promise<User | null> {
  if (!db) {
    console.warn('Firestore is not initialized');
    return null;
  }

  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return null;
  }

  const data = userSnap.data();
  return {
    uid,
    nickname: data.nickname,
    role: data.role as UserRole,
    createdAt: data.createdAt?.toDate() || new Date(),
    lastLoginAt: data.lastLoginAt?.toDate() || new Date(),
  };
}

/**
 * 최초 로그인 시 users/{uid} 생성
 */
export async function createUserProfile(uid: string, email: string) {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  const userRef = doc(db, 'users', uid);

  // 이미 존재하면 lastLoginAt만 업데이트
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    await updateDoc(userRef, {
      lastLoginAt: serverTimestamp(),
    });
    return;
  }

  // 신규 생성 (닉네임 없음, role = pending)
  await setDoc(userRef, {
    email,
    nickname: '', // 닉네임 미설정
    role: 'pending', // 기본값
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  });
}

/**
 * 닉네임 설정 (온보딩)
 */
export async function setNickname(uid: string, nicknameValue: string) {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    nickname: nicknameValue,
  });
}

/**
 * 닉네임 중복 체크 (선택 사항)
 */
export async function isNicknameTaken(): Promise<boolean> {
  // 간단 구현: Firestore query로 nickname 검색
  // MVP에서는 생략하고 나중에 추가 가능
  return false;
}
