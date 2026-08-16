import { getAccessToken } from './firebase';

export interface DriveUploadResult {
  fileId: string;
  webUrl?: string;
  fileName: string;
}

/**
 * Ensures an organization folder exists in Google Drive and uploads a document (invoice or quotation PDF) to it.
 */
export async function syncDocumentToGoogleDrive(
  fileBlob: Blob,
  fileName: string,
  folderName: string = "MiraSuite_Organization_Docs",
  mimeType: string = "application/pdf"
): Promise<DriveUploadResult> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Google Drive access token is missing or expired. Please sign in with Google to enable automatic background drive sync.');
  }

  // 1. Find or Create Folder
  let folderId = "";
  try {
    const searchFolderQuery = encodeURIComponent(
      `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    );
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${searchFolderQuery}&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        folderId = searchData.files[0].id;
      }
    }
  } catch (err) {
    console.warn("Folder search error in drive sync:", err);
  }

  if (!folderId) {
    // Create folder
    try {
      const createFolderRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: "application/vnd.google-apps.folder"
        })
      });
      if (createFolderRes.ok) {
        const folderData = await createFolderRes.json();
        folderId = folderData.id;
      }
    } catch (err) {
      console.warn("Folder creation error in drive sync:", err);
    }
  }

  // 2. Upload File
  const formData = new FormData();
  const metadata: any = {
    name: fileName,
    mimeType: mimeType
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  formData.append("file", fileBlob);

  const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  if (!uploadRes.ok) {
    const errorData = await uploadRes.json();
    throw new Error(`Google Drive upload failed: ${errorData?.error?.message || uploadRes.statusText}`);
  }

  const result = await uploadRes.json();
  return {
    fileId: result.id,
    webUrl: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
    fileName: fileName
  };
}
