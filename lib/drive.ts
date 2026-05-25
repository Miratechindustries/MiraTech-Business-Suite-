import { getAccessToken } from './firebase';

export async function uploadToDrive(
  fileData: Blob,
  fileName: string,
  mimeType: string = 'application/pdf'
): Promise<string> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('No access token available. Please sign in with Google.');
  }

  const formData = new FormData();
  
  // Metadata for the file
  const metadata = {
    name: fileName,
    mimeType: mimeType,
  };

  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', fileData);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to upload to Drive: ${errorData.error.message}`);
  }

  const result = await response.json();
  return result.id;
}
