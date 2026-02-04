/**
 * Diagram Compression Utility
 * 
 * Handles compression and decompression of diagram data using gzip.
 * Compresses on frontend before sending to backend to save network bandwidth.
 */

import pako from 'pako';

// Magic bytes to identify gzip data
const GZIP_MAGIC = [0x1f, 0x8b];

/**
 * Check if data is already gzip compressed
 */
export function isGzipCompressed(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === GZIP_MAGIC[0] && data[1] === GZIP_MAGIC[1];
}

/**
 * Compress diagram data to gzip format
 * Returns compressed Uint8Array
 */
export function compressDiagramData(data: string | object): Uint8Array {
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(jsonString);
  
  // Use best compression (level 9)
  return pako.gzip(uint8Array, { level: 9 });
}

/**
 * Decompress gzip data back to diagram data
 */
export function decompressDiagramData<T = object>(compressedData: Uint8Array): T {
  // Check if actually compressed
  if (!isGzipCompressed(compressedData)) {
    // Already uncompressed, parse as JSON
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(compressedData));
  }
  
  const decompressed = pako.ungzip(compressedData);
  const decoder = new TextDecoder();
  const jsonString = decoder.decode(decompressed);
  return JSON.parse(jsonString);
}

/**
 * Create a compressed .flowstry blob for upload
 */
export function createCompressedFlowstryBlob(data: string | object): Blob {
  const compressed = compressDiagramData(data);
  // Create a copy of the buffer as ArrayBuffer for Blob compatibility
  const arrayBuffer = compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength) as ArrayBuffer;
  return new Blob([arrayBuffer], { type: 'application/gzip' });
}

/**
 * Parse a .flowstry file (handles both compressed and uncompressed)
 */
export async function parseFlowstryFile<T = object>(file: Blob): Promise<T> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  return decompressDiagramData<T>(uint8Array);
}

/**
 * Export diagram as a compressed .flowstry file for download
 */
export function downloadCompressedFlowstry(data: object, filename: string): void {
  const compressed = compressDiagramData(data);
  // Create a copy of the buffer as ArrayBuffer for Blob compatibility
  const arrayBuffer = compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'application/gzip' });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.flowstry') ? filename : `${filename}.flowstry`;
  
  document.body.appendChild(link);
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get compression stats
 */
export function getCompressionStats(originalData: string | object): {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
} {
  const jsonString = typeof originalData === 'string' ? originalData : JSON.stringify(originalData);
  const originalSize = new Blob([jsonString]).size;
  const compressed = compressDiagramData(originalData);
  const compressedSize = compressed.length;
  
  return {
    originalSize,
    compressedSize,
    compressionRatio: Math.round((1 - compressedSize / originalSize) * 100),
  };
}
