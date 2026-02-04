package services

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"os"
)

var (
	ErrMasterKeyNotSet = errors.New("ENCRYPTION_MASTER_KEY environment variable not set")
	ErrInvalidKeySize  = errors.New("invalid key size")
)

// EncryptionService handles encryption operations
type EncryptionService struct {
	masterKey []byte
}

// NewEncryptionService creates a new encryption service
func NewEncryptionService() (*EncryptionService, error) {
	masterKeyHex := os.Getenv("ENCRYPTION_MASTER_KEY")
	if masterKeyHex == "" {
		// fallback for dev/testing if not set, BUT ideally should error in prod
		// For this implementation, we will require it.
		// If the user hasn't set it yet, we can't proceed safely.
		// However, to avoid breaking everything immediately if they haven't set it,
		// we *could* log a warning, but for security critical features, fail fast is better.
		return nil, ErrMasterKeyNotSet
	}

	masterKey, err := hex.DecodeString(masterKeyHex)
	if err != nil {
		return nil, err
	}

	if len(masterKey) != 32 {
		return nil, ErrInvalidKeySize
	}

	return &EncryptionService{
		masterKey: masterKey,
	}, nil
}

// GenerateWorkspaceKey generates a random 32-byte key for a workspace
func (s *EncryptionService) GenerateWorkspaceKey() ([]byte, error) {
	key := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return nil, err
	}
	return key, nil
}

// EncryptWorkspaceKey encrypts the workspace key using the master key
func (s *EncryptionService) EncryptWorkspaceKey(workspaceKey []byte) ([]byte, error) {
	block, err := aes.NewCipher(s.masterKey)
	if err != nil {
		return nil, err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	ciphertext := aesGCM.Seal(nonce, nonce, workspaceKey, nil)
	return ciphertext, nil
}

// DecryptWorkspaceKey decrypts the workspace key using the master key
func (s *EncryptionService) DecryptWorkspaceKey(encryptedKey []byte) ([]byte, error) {
	block, err := aes.NewCipher(s.masterKey)
	if err != nil {
		return nil, err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := aesGCM.NonceSize()
	if len(encryptedKey) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}

	nonce, ciphertext := encryptedKey[:nonceSize], encryptedKey[nonceSize:]
	plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}
