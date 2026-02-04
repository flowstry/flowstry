package storage

import (
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"time"

	"cloud.google.com/go/storage"
)

// GCSClient wraps Google Cloud Storage operations
type GCSClient struct {
	client     *storage.Client
	bucketName string
}

// NewGCSClient creates a new GCS client
func NewGCSClient(ctx context.Context, bucketName string) (*GCSClient, error) {
	client, err := storage.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCS client: %w", err)
	}

	return &GCSClient{
		client:     client,
		bucketName: bucketName,
	}, nil
}

// UploadFile uploads data to GCS with gzip compression
// If data is already gzip compressed (starts with gzip magic bytes), it's uploaded as-is
func (g *GCSClient) UploadFile(ctx context.Context, objectName string, data []byte, contentType string) (string, int64, error) {
	bucket := g.client.Bucket(g.bucketName)
	obj := bucket.Object(objectName)

	var uploadData []byte
	var compressedSize int64

	// Check if data is already gzip compressed (magic bytes: 0x1f 0x8b)
	isAlreadyCompressed := len(data) >= 2 && data[0] == 0x1f && data[1] == 0x8b

	if isAlreadyCompressed {
		// Data is already compressed, use as-is
		uploadData = data
		compressedSize = int64(len(data))
	} else {
		// Compress data with maximum compression
		var compressedBuf bytes.Buffer
		gzipWriter, err := gzip.NewWriterLevel(&compressedBuf, gzip.BestCompression)
		if err != nil {
			return "", 0, fmt.Errorf("failed to create gzip writer: %w", err)
		}

		if _, err := gzipWriter.Write(data); err != nil {
			return "", 0, fmt.Errorf("failed to write to gzip: %w", err)
		}

		if err := gzipWriter.Close(); err != nil {
			return "", 0, fmt.Errorf("failed to close gzip writer: %w", err)
		}

		uploadData = compressedBuf.Bytes()
		compressedSize = int64(len(uploadData))
	}

	// Write to GCS
	writer := obj.NewWriter(ctx)
	writer.ContentType = contentType
	writer.ContentEncoding = "gzip"

	if _, err := writer.Write(uploadData); err != nil {
		return "", 0, fmt.Errorf("failed to write to GCS: %w", err)
	}

	if err := writer.Close(); err != nil {
		return "", 0, fmt.Errorf("failed to close GCS writer: %w", err)
	}

	return objectName, compressedSize, nil
}

// DownloadFile downloads a file from GCS and returns raw bytes (no decompression)
// Frontend handles decompression to reduce backend processing and maintain consistency
func (g *GCSClient) DownloadFile(ctx context.Context, objectName string) ([]byte, error) {
	bucket := g.client.Bucket(g.bucketName)
	obj := bucket.Object(objectName)

	reader, err := obj.NewReader(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCS reader: %w", err)
	}
	defer reader.Close()

	// Return raw bytes without decompression
	// Frontend will decompress using the same pako/gzip library used for compression
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read data: %w", err)
	}

	return data, nil
}

// DeleteFile removes a file from GCS
func (g *GCSClient) DeleteFile(ctx context.Context, objectName string) error {
	bucket := g.client.Bucket(g.bucketName)
	obj := bucket.Object(objectName)

	if err := obj.Delete(ctx); err != nil {
		return fmt.Errorf("failed to delete from GCS: %w", err)
	}

	return nil
}

// GetSignedURL generates a signed URL for temporary access
func (g *GCSClient) GetSignedURL(ctx context.Context, objectName string, method string, contentType string, expiry time.Duration) (string, error) {
	bucket := g.client.Bucket(g.bucketName)

	opts := &storage.SignedURLOptions{
		Method:  method,
		Expires: time.Now().Add(expiry),
	}

	if contentType != "" {
		opts.ContentType = contentType
	}

	url, err := bucket.SignedURL(objectName, opts)
	if err != nil {
		return "", fmt.Errorf("failed to generate signed URL: %w", err)
	}

	return url, nil
}

// Close closes the GCS client
func (g *GCSClient) Close() error {
	return g.client.Close()
}
