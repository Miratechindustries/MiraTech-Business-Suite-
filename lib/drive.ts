import { getAccessToken } from './firebase';

export async function uploadToDrive(
  data: Blob | object,
  fileName: string,
  token?: string
): Promise<string> {
  const accessToken = token || (await getAccessToken());
  if (!accessToken) {
    throw new Error('Google OAuth access token required. Please sign in with Google Drive permissions.');
  }

  // 1. Find or create "MiraTechBusinessSuite" folder
  const folderName = "MiraTechBusinessSuite";
  let parentFolderId = await findOrCreateFolder(accessToken, folderName);

  // 2. Determine mimeType and payload
  let mimeType = 'application/json';
  let fileBlob: Blob;

  if (data instanceof Blob) {
    fileBlob = data;
    mimeType = data.type || 'application/pdf';
  } else {
    const fileContent = JSON.stringify(data, null, 2);
    fileBlob = new Blob([fileContent], { type: 'application/json' });
  }

  const metadata = {
    name: fileName,
    mimeType,
    parents: [parentFolderId]
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', fileBlob);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to upload to Google Drive: ${errorData.error?.message || response.statusText}`);
  }

  const result = await response.json();
  return result.id;
}

export async function uploadBackupToGoogleDrive(
  backupJson: object,
  fileName: string,
  token?: string
): Promise<string> {
  return uploadToDrive(backupJson, fileName, token);
}

async function findOrCreateFolder(token: string, folderName: string, parentId?: string): Promise<string> {
  let query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // Create folder
  const metadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`Failed to create Google Drive folder ${folderName}: ${err.error?.message}`);
  }

  const folder = await createRes.json();
  return folder.id;
}
