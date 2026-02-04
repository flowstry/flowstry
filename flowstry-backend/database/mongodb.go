package database

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var client *mongo.Client
var database *mongo.Database

// Connect establishes a connection to MongoDB
func Connect(uri, dbName string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOptions := options.Client().ApplyURI(uri)
	var err error
	client, err = mongo.Connect(ctx, clientOptions)
	if err != nil {
		return err
	}

	// Ping to verify connection
	if err = client.Ping(ctx, nil); err != nil {
		return err
	}

	database = client.Database(dbName)
	log.Printf("Connected to MongoDB database: %s", dbName)
	return nil
}

// IsConnected returns true if database connection is established
func IsConnected() bool {
	return database != nil
}

// GetCollection returns a collection by name
func GetCollection(name string) *mongo.Collection {
	if database == nil {
		return nil
	}
	return database.Collection(name)
}

// GetDatabase returns the database instance
func GetDatabase() *mongo.Database {
	return database
}

// Disconnect closes the MongoDB connection
func Disconnect() {
	if client != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := client.Disconnect(ctx); err != nil {
			log.Printf("Error disconnecting from MongoDB: %v", err)
		}
		log.Println("Disconnected from MongoDB")
	}
}
