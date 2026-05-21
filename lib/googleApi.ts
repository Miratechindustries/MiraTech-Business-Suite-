export interface LedgerMetric {
  name: string;
  value: string | number;
  category: string;
}

export async function syncToGoogleSheets(
  accessToken: string,
  companyName: string,
  metrics: LedgerMetric[]
): Promise<string> {
  try {
    // 1. Create a Spreadsheet
    const createResponse = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          title: `MiraTech Executive Report - ${companyName} (${new Date().toLocaleDateString()})`,
        },
      }),
    });

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      throw new Error(`Failed to create spreadsheet: ${errText}`);
    }

    const spreadsheetData = await createResponse.json();
    const spreadsheetId = spreadsheetData.spreadsheetId;

    // 2. Format standard tables
    const rows = [
      ["MiraTech Corporate Executive Report & Ledger Engine"],
      ["Company Name", companyName],
      ["Synced Date", new Date().toLocaleString()],
      [],
      ["Report Metric Category", "Metric Key", "Reported Value"],
    ];

    metrics.forEach((m) => {
      rows.push([m.category, m.name, String(m.value)]);
    });

    // 3. Write rows to sheet
    const updateResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:C${rows.length}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: rows,
        }),
      }
    );

    if (!updateResponse.ok) {
      const errText = await updateResponse.text();
      throw new Error(`Failed to populate spreadsheet: ${errText}`);
    }

    return spreadsheetId;
  } catch (error) {
    console.error("Google Sheets Sync Error:", error);
    throw error;
  }
}

export async function uploadToGoogleDrive(
  accessToken: string,
  fileName: string,
  pdfBase64Data: string
): Promise<string> {
  try {
    // Convert base64 to binary block
    const byteCharacters = atob(pdfBase64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/pdf" });

    // Multi-part form-data simulation
    const metadata = {
      name: fileName,
      mimeType: "application/pdf",
    };

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", blob);

    const uploadResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      }
    );

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      throw new Error(`Failed to upload to Google Drive: ${errText}`);
    }

    const uploadData = await uploadResponse.json();
    return uploadData.id;
  } catch (error) {
    console.error("Google Drive Upload Error:", error);
    throw error;
  }
}
