import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const ROOT_FOLDER_ID = '19nSZtewSXL8JsKJK1C-zVEZQoX3ct0Ev';
const NEWS_DIR = path.resolve('news');
const KEY_FILE = path.resolve('the-tesla-thesis-40967df2aae1.json');

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });

  // Get existing local files
  const localFiles = new Set(fs.readdirSync(NEWS_DIR).filter(f => f.endsWith('.txt')));

  // Recursively collect all txt files from folder and subfolders
  async function listFilesRecursive(folderId) {
    let allFiles = [];
    let pageToken = undefined;

    // Get txt files in this folder
    do {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and mimeType = 'text/plain' and trashed = false`,
        fields: 'nextPageToken, files(id, name, modifiedTime)',
        pageSize: 100,
        pageToken,
      });
      allFiles.push(...(res.data.files || []));
      pageToken = res.data.nextPageToken;
    } while (pageToken);

    // Get subfolders in this folder
    pageToken = undefined;
    do {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'nextPageToken, files(id, name)',
        pageSize: 100,
        pageToken,
      });

      for (const folder of (res.data.files || [])) {
        console.log(`Entering subfolder: ${folder.name}`);
        const subFiles = await listFilesRecursive(folder.id);
        allFiles.push(...subFiles);
      }
      pageToken = res.data.nextPageToken;
    } while (pageToken);

    return allFiles;
  }

  const remoteFiles = await listFilesRecursive(ROOT_FOLDER_ID);
  console.log(`Found ${remoteFiles.length} files in Drive, ${localFiles.size} local`);

  // Download new/updated files
  let downloaded = 0;
  for (const file of remoteFiles) {
    if (!file.name || !file.id) continue;

    // Skip Drive summaries — we generate our own. Only pull xdaily summaries (X/Twitter).
    if (file.name.endsWith('_summary.txt') && !file.name.includes('xdaily')) continue;

    const localPath = path.join(NEWS_DIR, file.name);
    const exists = localFiles.has(file.name);

    // Skip if file exists and hasn't been modified
    if (exists) {
      const localMtime = fs.statSync(localPath).mtime;
      const remoteMtime = new Date(file.modifiedTime);
      if (remoteMtime <= localMtime) continue;
    }

    // Download file
    const res = await drive.files.get(
      { fileId: file.id, alt: 'media' },
      { responseType: 'text' }
    );

    fs.writeFileSync(localPath, res.data);
    downloaded++;
    console.log(`${exists ? 'Updated' : 'New'}: ${file.name}`);
  }

  if (downloaded === 0) {
    console.log('Already up to date');
  } else {
    console.log(`Downloaded ${downloaded} file(s)`);
  }
}

main().catch(err => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
