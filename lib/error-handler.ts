import { toast } from 'sonner';

export const handleAppError = (error: any, title?: string) => {
  console.error(`[App Error] ${title || 'Error'}:`, error);
  
  // Ignore user cancellations
  if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-by-user') {
    return;
  }

  let message = 'An unexpected error occurred. Please try again.';
  
  const errorCode = error?.code || '';
  const errorMessage = (error?.message || '').toLowerCase();
  
  if (errorCode === 'auth/invalid-credential' || errorMessage.includes('invalid-credential') || errorMessage.includes('auth/invalid-credential')) {
    message = 'Authentication failed. Please verify your email and password.';
  } else if (
    errorCode === 'auth/network-request-failed' || 
    errorMessage.includes('network-request-failed') || 
    errorMessage.includes('network_request_failed')
  ) {
    message = 'Network connection failed. Please ensure you are connected to the internet and not blocking identity endpoints.';
  } else if (
    errorCode === 'permission-denied' || 
    errorCode === 'firestore/permission-denied' ||
    errorMessage.includes('permission-denied') || 
    errorMessage.includes('insufficient permissions')
  ) {
    message = 'Access Denied: You do not have the required permissions for this action.';
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
