import { toast } from 'sonner';

export const handleAppError = (error: unknown, title?: string) => {
  console.error(`[App Error] ${title || 'Error'}:`, error);
  
  let message = 'An unexpected error occurred. Please try again.';
  
  if (error instanceof Error) {
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
