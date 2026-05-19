import { toast } from 'sonner';

export const handleAppError = (error: any, title?: string) => {
  console.error(`[App Error] ${title || 'Error'}:`, error);
  
  // Ignore user cancellations
  if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-by-user') {
    return;
  }

  let message = 'An unexpected error occurred. Please try again.';
  
  if (error?.code === 'auth/invalid-credential') {
    message = 'Authentication failed. Please verify your credentials.';
  } else if (
    error?.code === 'permission-denied' || 
    error?.message?.toLowerCase().includes('permission-denied') || 
    error?.message?.toLowerCase().includes('insufficient permissions')
  ) {
    message = 'Security protocol prevents this action. Please check your access level.';
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }
  
  toast.error(title || 'Operation Failed', {
    description: message,
  });
};

export const notifySuccess = (title: string, message?: string) => {
  toast.success(title, {
    description: message,
  });
};

export const notifyInfo = (title: string, message?: string) => {
  toast.info(title, {
    description: message,
  });
};
