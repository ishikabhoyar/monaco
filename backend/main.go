package main

import (
	"fmt"
	"net/http"

	"github.com/arnab-afk/monaco/handler"
)

func main() {
	h := handler.NewHandler()

	http.HandleFunc("/submit", h.SubmitHandler)
	http.HandleFunc("/status", h.StatusHandler)
	http.HandleFunc("/result", h.ResultHandler)

	fmt.Println("Server started at :8080")
	http.ListenAndServe(":8080", nil)
}
