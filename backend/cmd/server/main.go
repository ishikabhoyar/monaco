package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/arnab-afk/monaco/internal/api"
)

func main() {
	// Configure logging
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.SetOutput(os.Stdout)

	log.Println("Starting Monaco code execution backend...")

	// Initialize router with all routes
	router := api.SetupRoutes()

	// Start the server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	log.Printf("Server started at :%s", port)
	log.Fatal(server.ListenAndServe())
}
