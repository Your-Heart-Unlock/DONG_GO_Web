'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase/client';
import { Photo } from '@/types';

interface PhotoGalleryProps {
  placeId: string;
}

export default function PhotoGallery({ placeId }: PhotoGalleryProps) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 사진 목록 로드
  useEffect(() => {
    fetchPhotos();
  }, [placeId]);

  async function fetchPhotos() {
    setLoading(true);
    try {
      const response = await fetch(`/api/places/${placeId}/photos`);
      if (response.ok) {
        const data = await response.json();
        setPhotos(data.photos || []);
      }
    } catch (error) {
      console.error('Failed to fetch photos:', error);
    } finally {
      setLoading(false);
    }
  }

  // 이미지 압축 (Canvas API 사용)
  async function compressImage(file: File): Promise<File> {
    const MAX_DIMENSION = 1920;
    const QUALITY = 0.85;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // 이미 충분히 작으면 원본 반환
        if (width <= MAX_DIMENSION && height <= MAX_DIMENSION && file.size < 3 * 1024 * 1024) {
          resolve(file);
          return;
        }

        // 비율 유지하며 리사이즈
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
            });
            console.log(`[PhotoGallery] 압축: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(compressed.size / 1024 / 1024).toFixed(1)}MB`);
            resolve(compressed);
          },
          'image/jpeg',
          QUALITY
        );
      };
      img.onerror = () => reject(new Error('이미지 로드 실패'));
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      // 메모리 누수 방지
      img.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once: true });
    });
  }

  // 사진 업로드
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  }

  // 실제 파일 업로드 로직 (재사용 가능)
  async function uploadFile(file: File) {
    // 이미지 타입 체크
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    // 원본 파일 크기 체크 (10MB 초과는 압축 전에 거부)
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB 이하여야 합니다.');
      return;
    }

    if (!auth?.currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // 이미지 압축 (Vercel 4.5MB 페이로드 제한 대응)
      const compressed = await compressImage(file);

      if (compressed.size > 4 * 1024 * 1024) {
        alert('이미지 압축 후에도 파일이 너무 큽니다. 더 작은 이미지를 사용해주세요.');
        setUploading(false);
        return;
      }

      const token = await auth.currentUser.getIdToken();
      const formData = new FormData();
      formData.append('photo', compressed);

      // XMLHttpRequest를 사용하여 progress 추적
      const xhr = new XMLHttpRequest();

      // Progress 이벤트 리스너
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      // 업로드 완료 처리
      const uploadPromise = new Promise<Photo>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch {
              reject(new Error('Failed to parse response'));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.error || 'Upload failed'));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });
      });

      xhr.open('POST', `/api/places/${placeId}/photos`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);

      const newPhoto = await uploadPromise;
      setPhotos([...photos, newPhoto]);

      // 파일 입력 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      alert('사진 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  // 사진 삭제
  async function handleDeletePhoto(photoId: string) {
    if (!confirm('이 사진을 삭제하시겠습니까?')) return;

    try {
      if (!auth?.currentUser) {
        alert('로그인이 필요합니다.');
        return;
      }

      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/places/${placeId}/photos/${photoId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }

      setPhotos(photos.filter((p) => p.photoId !== photoId));
    } catch (error) {
      console.error('Photo delete error:', error);
      alert('사진 삭제에 실패했습니다.');
    }
  }

  // 사진 클릭 시 확대
  function handlePhotoClick(url: string) {
    window.open(url, '_blank');
  }

  // 드래그 앤 드롭 핸들러
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find((file) => file.type.startsWith('image/'));

    if (imageFile) {
      await uploadFile(imageFile);
    } else if (files.length > 0) {
      alert('이미지 파일만 업로드 가능합니다.');
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">사진</h3>
        <div className="text-center py-8 text-gray-500">
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          사진 {photos.length > 0 && `(${photos.length})`}
        </h3>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? '업로드 중...' : '사진 추가'}
          </button>
        </div>
      </div>

      {/* 업로드 진행률 표시 */}
      {uploading && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">업로드 중...</span>
            <span className="text-sm font-medium text-blue-600">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {photos.length === 0 ? (
        <div
          className={`text-center py-12 border-2 border-dashed rounded-lg transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <svg
            className={`w-12 h-12 mx-auto mb-3 ${
              isDragging ? 'text-blue-500' : 'text-gray-300'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className={isDragging ? 'text-blue-600 font-medium' : 'text-gray-500'}>
            {isDragging ? '이미지를 여기에 놓으세요' : '아직 사진이 없습니다.'}
          </p>
          {!isDragging && (
            <p className="text-sm mt-1 text-gray-400">
              사진 추가 버튼을 누르거나 이미지를 드래그하여 업로드하세요
            </p>
          )}
        </div>
      ) : (
        <div
          className={`grid grid-cols-2 sm:grid-cols-3 gap-3 relative ${
            isDragging ? 'ring-2 ring-blue-500 ring-offset-2 rounded-lg' : ''
          }`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* 드래그 오버레이 */}
          {isDragging && (
            <div className="absolute inset-0 bg-blue-50 bg-opacity-90 rounded-lg flex items-center justify-center z-10 pointer-events-none">
              <div className="text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-2 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-blue-600 font-medium">이미지를 여기에 놓으세요</p>
              </div>
            </div>
          )}

          {photos.map((photo) => (
            <div
              key={photo.photoId}
              className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group"
            >
              <img
                src={photo.url}
                alt="장소 사진"
                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => handlePhotoClick(photo.url)}
              />
              {/* 삭제 버튼: 본인이 업로드한 사진이거나 owner만 */}
              {(photo.uploadedBy === user?.uid || user?.role === 'owner') && (
                <button
                  onClick={() => handleDeletePhoto(photo.photoId)}
                  className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                  aria-label="사진 삭제"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
