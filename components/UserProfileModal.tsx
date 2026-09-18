'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { 
  Camera, 
  Upload, 
  Trash2, 
  RotateCw, 
  Check, 
  X, 
  Loader2, 
  AlertCircle, 
  ShieldCheck,
  User as UserIcon,
  Sparkles,
  RefreshCw,
  VideoOff
} from 'lucide-react';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useUserStore, useToastStore } from '../lib/store';
import { logAction } from '../lib/audit';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Optimizes an image (downscales to max 400x400 and compresses as WebP/JPEG)
 * to keep Firestore document size safely below 80KB while retaining high retina fidelity.
 */
function compressProfileImage(source: HTMLImageElement | HTMLVideoElement): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const MAX_DIMENSION = 360;
      let width = 0;
      let height = 0;

      if (source instanceof HTMLVideoElement) {
        width = source.videoWidth || 640;
        height = source.videoHeight || 480;
      } else {
        width = source.naturalWidth || source.width;
        height = source.naturalHeight || source.height;
      }

      if (width === 0 || height === 0) {
        throw new Error('Invalid image dimensions');
      }

      // Compute square crop bounding box (center crop)
      const minDim = Math.min(width, height);
      const startX = (width - minDim) / 2;
      const startY = (height - minDim) / 2;

      // Output square 360x360
      canvas.width = MAX_DIMENSION;
      canvas.height = MAX_DIMENSION;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas context unavailable');
      }

      // Smooth sampling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw cropped square
      ctx.drawImage(
        source,
        startX,
        startY,
        minDim,
        minDim,
        0,
        0,
        MAX_DIMENSION,
        MAX_DIMENSION
      );

      // Attempt webp at 0.85, fallback to jpeg if unsupported
      let dataUrl = canvas.toDataURL('image/webp', 0.85);
      if (!dataUrl.startsWith('data:image/webp')) {
        dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      }

      resolve(dataUrl);
    } catch (err) {
      reject(err);
    }
  });
}

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { currentUser, setCurrentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);

  const [displayName, setDisplayName] = useState('');
  const [positionTitle, setPositionTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Camera capture state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop media stream tracks cleanly
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setCameraLoading(false);
  }, []);

  // Initialize data on modal open
  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
      return;
    }

    setErrorMessage(null);
    const activeAuthUser = auth.currentUser;
    const initialEmail = currentUser?.email || activeAuthUser?.email || '';
    const initialName = currentUser?.displayName || currentUser?.name || activeAuthUser?.displayName || initialEmail.split('@')[0] || '';
    const initialPhoto = currentUser?.profilePic || currentUser?.photoURL || activeAuthUser?.photoURL || null;

    setDisplayName(initialName);
    setPositionTitle(currentUser?.positionTitle || '');
    setPhone(currentUser?.phone || '');
    setPhotoPreview(initialPhoto);

    // Fetch freshest document from Firestore /users/{uid}
    if (activeAuthUser?.uid) {
      setLoadingProfile(true);
      const userRef = doc(db, 'users', activeAuthUser.uid);
      getDoc(userRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const pic = data.profilePic || data.photoURL || activeAuthUser.photoURL || null;
            setPhotoPreview(pic);
            if (data.displayName || data.name) {
              setDisplayName(data.displayName || data.name);
            }
            if (data.positionTitle) setPositionTitle(data.positionTitle);
            if (data.phone) setPhone(data.phone);
          }
        })
        .catch((err) => {
          console.warn('[UserProfileModal] Failed to read fresh user profile:', err);
        })
        .finally(() => {
          setLoadingProfile(false);
        });
    }
  }, [isOpen, currentUser, stopCameraStream]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Start Camera Stream
  const startCamera = async (facingMode: 'user' | 'environment' = cameraFacing) => {
    setErrorMessage(null);
    setCameraLoading(true);
    stopCameraStream();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera device access is not supported by your browser.');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      setHasCameraPermission(true);
      setIsCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.error('[UserProfileModal] Camera start error:', err);
      setHasCameraPermission(false);
      setIsCameraActive(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Camera access was denied. Please allow camera permissions in your browser bar.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No camera device was detected on your hardware.');
      } else {
        setErrorMessage(err.message || 'Could not initialize live camera feed.');
      }
    } finally {
      setCameraLoading(false);
    }
  };

  // Switch between front/rear camera
  const handleToggleFacingMode = () => {
    const nextMode = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextMode);
    startCamera(nextMode);
  };

  // Capture still from live video element
  const handleSnapPhoto = async () => {
    if (!videoRef.current) return;
    try {
      setCameraLoading(true);
      const compressedDataUri = await compressProfileImage(videoRef.current);
      setPhotoPreview(compressedDataUri);
      stopCameraStream();
      addToast('Profile snapshot captured! Click "Save Profile" to apply.', 'info');
    } catch (err: any) {
      console.error('[UserProfileModal] Snapshot capture error:', err);
      setErrorMessage('Failed to capture frame from camera.');
    } finally {
      setCameraLoading(false);
    }
  };

  // Handle manual file selection (from File Manager)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reject non-images
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    // Reject massive raw payloads
    if (file.size > 8 * 1024 * 1024) {
      setErrorMessage('Image file is too large (max 8MB). Please choose a lighter file.');
      return;
    }

    setErrorMessage(null);
    stopCameraStream();

    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = async () => {
        try {
          const compressed = await compressProfileImage(img);
          setPhotoPreview(compressed);
          addToast('Photo loaded and optimized for workspace sync.', 'info');
        } catch (err: any) {
          console.error('[UserProfileModal] Image compression error:', err);
          setErrorMessage('Failed to process and compress selected image.');
        }
      };
      img.onerror = () => {
        setErrorMessage('Failed to decode the chosen image file.');
      };
      img.src = reader.result as string;
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read file from disk.');
    };
    reader.readAsDataURL(file);

    // Reset input value so re-selecting same file triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove photo
  const handleRemovePhoto = () => {
    stopCameraStream();
    setPhotoPreview(null);
    setErrorMessage(null);
  };

  // Save profile to Firestore and sync auth
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeAuthUser = auth.currentUser;
    if (!activeAuthUser) {
      setErrorMessage('Authentication session expired. Please log in again.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const trimmedName = displayName.trim() || activeAuthUser.email?.split('@')[0] || 'User';
      const trimmedPosition = positionTitle.trim();
      const trimmedPhone = phone.trim();

      // 1. Update Firebase Auth user profile object
      await updateProfile(activeAuthUser, {
        displayName: trimmedName,
        // Firebase Auth photoURL can hold a standard URL or data URI
        photoURL: photoPreview || ''
      });

      // 2. Persist to Firestore /users/{uid} document with profilePic & photoURL
      const userDocRef = doc(db, 'users', activeAuthUser.uid);
      const updatePayload: Record<string, any> = {
        name: trimmedName,
        displayName: trimmedName,
        positionTitle: trimmedPosition,
        phone: trimmedPhone,
        profilePic: photoPreview || null,
        photoURL: photoPreview || null,
        updatedAt: new Date().toISOString()
      };

      // Set with merge to ensure document exists even if not created during signup
      await setDoc(userDocRef, updatePayload, { merge: true });

      // 3. Update Zustand global store
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          displayName: trimmedName,
          name: trimmedName,
          positionTitle: trimmedPosition,
          phone: trimmedPhone,
          profilePic: photoPreview || undefined,
          photoURL: photoPreview || undefined
        });
      }

      // 4. Audit Log
      try {
        await logAction(
          'UPDATE_USER_PROFILE',
          `Updated workspace profile identity and avatar for ${activeAuthUser.email}`,
          'AUTH'
        );
      } catch (auditErr) {
        console.warn('[UserProfileModal] Audit log warning:', auditErr);
      }

      addToast('Profile and workspace photo updated successfully!', 'success');
      stopCameraStream();
      onClose();
    } catch (err: any) {
      console.error('[UserProfileModal] Save profile error:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${activeAuthUser.uid}`);
      setErrorMessage(err.message || 'Failed to persist profile details to Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      id="modal-user-profile-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
    >
      <div 
        id="modal-user-profile-card"
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                Workspace Identity & Profile Photo
              </h2>
              <p className="text-[11px] text-slate-500 font-semibold">
                Capture via device camera or upload from files. Stored securely in Firestore.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {errorMessage && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-semibold">{errorMessage}</div>
            </div>
          )}

          {/* Photo Management Section */}
          <div className="space-y-3">
            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Profile Photo & Workspace Identity
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              {/* Photo Display or Camera Viewfinder */}
              <div className="relative shrink-0">
                {isCameraActive ? (
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-2 border-blue-500 shadow-md bg-black flex items-center justify-center">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-cover"
                    />
                    {cameraLoading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                    )}
                  </div>
                ) : photoPreview ? (
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-xs bg-white">
                    <img
                      src={photoPreview}
                      alt="Profile Avatar"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-1 right-1 p-1 bg-emerald-500 text-white rounded-full shadow-xs" title="Verified Photo">
                      <ShieldCheck className="w-3 h-3" />
                    </div>
                  </div>
                ) : (
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 gap-1">
                    <UserIcon className="w-9 h-9 stroke-[1.5]" />
                    <span className="text-[10px] font-bold text-slate-400">No Photo</span>
                  </div>
                )}
              </div>

              {/* Action Buttons for Camera & File Picker */}
              <div className="flex-1 w-full space-y-2">
                {isCameraActive ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        id="btn-snap-camera-photo"
                        onClick={handleSnapPhoto}
                        disabled={cameraLoading}
                        className="flex-1 min-w-[120px] py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Snap Photo</span>
                      </button>

                      <button
                        type="button"
                        id="btn-switch-camera-facing"
                        onClick={handleToggleFacingMode}
                        className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                        title="Switch Camera (Front/Rear)"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        id="btn-cancel-camera"
                        onClick={stopCameraStream}
                        className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                        title="Cancel Camera"
                      >
                        <VideoOff className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[10px] text-blue-600 font-medium leading-tight">
                      Center your face in the viewfinder and click &quot;Snap Photo&quot;.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {/* Device Camera Button */}
                      <button
                        type="button"
                        id="btn-open-device-camera"
                        onClick={() => startCamera()}
                        disabled={cameraLoading}
                        className="flex-1 min-w-[130px] py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {cameraLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Camera className="w-4 h-4 text-sky-400" />
                        )}
                        <span>Use Camera</span>
                      </button>

                      {/* File Manager Button */}
                      <button
                        type="button"
                        id="btn-upload-file-manager"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 min-w-[130px] py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl shadow-3xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-blue-600" />
                        <span>File Manager</span>
                      </button>

                      {/* Hidden File Input supporting gallery / manager and direct camera capture fallbacks */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>

                    {photoPreview && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Photo ready for sync
                        </span>
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="text-[10px] font-extrabold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Remove Photo
                        </button>
                      </div>
                    )}

                    <p className="text-[10px] text-slate-400 font-medium leading-tight">
                      Supported: JPG, PNG, WebP. Automatically square-cropped and optimized to 360x360 for high performance.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* User Profile Text Details */}
          <form onSubmit={handleSave} id="user-profile-form" className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Account Email Address (Read-Only)
              </label>
              <input
                type="email"
                disabled
                value={auth.currentUser?.email || currentUser?.email || ''}
                className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-xl bg-slate-100/70 text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Full Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Johnathan Doe"
                className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-xl bg-white focus:outline-hidden focus:border-blue-500 transition shadow-3xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Position / Job Title
                </label>
                <input
                  type="text"
                  value={positionTitle}
                  onChange={(e) => setPositionTitle(e.target.value)}
                  placeholder="e.g. Senior Operations Officer"
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-xl bg-white focus:outline-hidden focus:border-blue-500 transition shadow-3xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +1 (555) 019-2834"
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-xl bg-white focus:outline-hidden focus:border-blue-500 transition shadow-3xs"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600">
              <span className="font-bold text-[11px] uppercase tracking-wider text-slate-500">
                Workspace Role Clearance:
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-150">
                {currentUser?.role ? currentUser.role.replace(/_/g, ' ') : 'STAFF ACCESS'}
              </span>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            disabled={isSaving}
            className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            form="user-profile-form"
            disabled={isSaving || loadingProfile}
            id="btn-save-user-profile"
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Persisting to Firestore...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save Profile</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
