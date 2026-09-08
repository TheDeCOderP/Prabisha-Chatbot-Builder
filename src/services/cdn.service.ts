// src/services/cdn.service.ts

/**
 * Server-only upload functionality for internal CDN
 * This file should only be imported in server-side code (API routes, server components)
 */

// ===== Internal CDN Upload Function =====
// Using native fetch and FormData (available in Node.js 18+)

const MEDIA_MANAGEMENT_URL = process.env.MEDIA_MANAGEMENT_URL || 'https://media-cdn.prabisha.com';
const MEDIA_UPLOAD_FOLDER = process.env.MEDIA_UPLOAD_FOLDER || 'prabisha-chatbot-builder';

export async function uploadToLocalCDN({
  file,
  base64Data,
}: {
  file: { name: string; type: string; size: number; lastModified: number };
  base64Data: string;
}): Promise<{ url: string }> {
  try {
    let mimeType, base64;
    const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
    if (matches) {
      mimeType = matches[1];
      base64 = matches[2];
    } else {
      // fallback: assume jpeg if no prefix
      mimeType = file.type || 'image/jpeg';
      base64 = base64Data;
      console.warn('[uploadToLocalCDN] No data URL prefix found, assuming image/jpeg');
    }
    
    const buffer = Buffer.from(base64, 'base64');
    
    // Create a Blob from the buffer for modern FormData
    const blob = new Blob([buffer], { type: mimeType });
    const formData = new FormData();
    formData.append('file', blob, file.name);
    
    // Send folder as query parameter instead of form data
    const uploadUrl = `${MEDIA_MANAGEMENT_URL}/upload?folder=${encodeURIComponent(MEDIA_UPLOAD_FOLDER)}`;
    
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('[uploadToLocalCDN] Upload failed:', res.status, errorText);
      throw new Error(`Local CDN upload failed: ${res.status} ${res.statusText}`);
    }
    
    const data: any = await res.json();
    console.log('[uploadToLocalCDN] Upload successful:', data.url);
    
    if (!data.success || !data.url) {
      throw new Error('No URL returned from local CDN');
    }
    
    return { url: data.url };
  } catch (error) {
    console.error('[uploadToLocalCDN] Error:', error);
    throw error;
  }
}

// ===== Local Public Upload Function =====
export async function uploadToLocalPublic({
  fileName,
  buffer,
  mimeType,
}: {
  fileName: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<{ url: string; publicId: string; size: number }> {
  try {
    const base64 = buffer.toString('base64');
    const base64Data = `data:${mimeType};base64,${base64}`;
    
    const result = await uploadToLocalCDN({
      file: {
        name: fileName,
        type: mimeType,
        size: buffer.length,
        lastModified: Date.now(),
      },
      base64Data,
    });
    
    return {
      url: result.url,
      publicId: fileName,
      size: buffer.length,
    };
  } catch (error) {
    console.error('[uploadToLocalPublic] Error:', error);
    throw error;
  }
}

// ===== Delete from Local Public =====
export async function deleteFromLocalPublic(publicId: string): Promise<void> {
  try {
    const deleteUrl = `${MEDIA_MANAGEMENT_URL}/delete?file=${encodeURIComponent(publicId)}`;
    
    const res = await fetch(deleteUrl, {
      method: 'DELETE',
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('[deleteFromLocalPublic] Delete failed:', res.status, errorText);
      throw new Error(`Failed to delete file: ${res.status} ${res.statusText}`);
    }
    
    console.log('[deleteFromLocalPublic] Delete successful:', publicId);
  } catch (error) {
    console.error('[deleteFromLocalPublic] Error:', error);
    throw error;
  }
}

// ===== Main Upload Types =====
export type UploadProvider = "local-public" | "local";

export interface UploadOptions {
  folder?: string;
  fileName?: string;
  transformation?: any; // Kept for compatibility but not used
  providers?: UploadProvider[];
}

export interface UploadResult {
  url: string;
  publicId?: string;
  provider: UploadProvider;
  width?: number;
  height?: number;
  format?: string;
  size?: number;
}

// ===== Main Upload Function =====
/**
 * Upload file with automatic fallback (Server-only)
 */
export async function uploadFile(
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const providers = options.providers || ["local-public", "local"];
  const errors: Record<string, string> = {};

  console.log(`[Upload] Starting upload process for ${options.fileName || 'unnamed file'} (${buffer.length} bytes)`);
  console.log(`[Upload] Trying providers in order: ${providers.join(', ')}`);

  for (const provider of providers) {
    try {
      console.log(`[Upload] Attempting ${provider} upload...`);
      
      switch (provider) {
        case "local-public":
          return await uploadToLocalPublicFolder(buffer, options);
        case "local":
          return await uploadToLocal(buffer, options);
      }
    } catch (error: any) {
      console.error(`[Upload] ${provider} failed:`, error.message);
      errors[provider] = error.message;
    }
  }

  const errorMessage = `All upload providers failed: ${JSON.stringify(errors)}`;
  console.error(`[Upload] ${errorMessage}`);
  throw new Error(errorMessage);
}

// ===== Provider-Specific Upload Functions =====
async function uploadToLocalPublicFolder(
  buffer: Buffer,
  options: UploadOptions
): Promise<UploadResult> {
  const fileName = options.fileName || `file-${Date.now()}`;
  
  // Determine MIME type
  let mimeType = 'application/octet-stream';
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  if (ext && mimeTypes[ext]) {
    mimeType = mimeTypes[ext];
  }

  const result = await uploadToLocalPublic({
    fileName,
    buffer,
    mimeType,
  });

  return {
    url: result.url,
    publicId: result.publicId,
    provider: "local-public",
    size: result.size,
  };
}

async function uploadToLocal(
  buffer: Buffer,
  options: UploadOptions
): Promise<UploadResult> {
  const base64 = buffer.toString('base64');
  const fileName = options.fileName || `file-${Date.now()}`;
  
  let mimeType = 'application/octet-stream';
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  if (ext && mimeTypes[ext]) {
    mimeType = mimeTypes[ext];
  }

  const base64Data = `data:${mimeType};base64,${base64}`;

  const result = await uploadToLocalCDN({
    file: {
      name: fileName,
      type: mimeType,
      size: buffer.length,
      lastModified: Date.now(),
    },
    base64Data,
  });

  return {
    url: result.url,
    provider: "local",
    size: buffer.length,
  };
}

// ===== Delete Function =====
export async function deleteFile(
  publicId: string,
  provider: UploadProvider
): Promise<void> {
  switch (provider) {
    case "local-public":
      await deleteFromLocalPublic(publicId);
      break;
    case "local":
      console.log("[Upload] Local CDN file deletion not implemented");
      break;
  }
}