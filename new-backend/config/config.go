package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all configuration for the application
type Config struct {
	Server     ServerConfig
	Executor   ExecutorConfig
	Languages  map[string]LanguageConfig
	Sandbox    SandboxConfig
}

// ServerConfig holds server-related configurations
type ServerConfig struct {
	Port         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
}

// ExecutorConfig holds executor-related configurations
type ExecutorConfig struct {
	ConcurrentExecutions int
	QueueCapacity        int
	DefaultTimeout       time.Duration
}

// LanguageConfig holds language-specific configurations
type LanguageConfig struct {
	Name         string
	Image        string
	MemoryLimit  string
	CPULimit     string
	TimeoutSec   int
	CompileCmd   []string
	RunCmd       []string
	FileExt      string
	VersionCmd   []string
}

// SandboxConfig holds sandbox-related configurations
type SandboxConfig struct {
	NetworkDisabled bool
	MemorySwapLimit string
	PidsLimit       int64
}

// GetConfig returns the application configuration
func GetConfig() *Config {
	return &Config{
		Server: ServerConfig{
			Port:         getEnv("PORT", "8080"),
			ReadTimeout:  time.Duration(getEnvAsInt("READ_TIMEOUT", 15)) * time.Second,
			WriteTimeout: time.Duration(getEnvAsInt("WRITE_TIMEOUT", 15)) * time.Second,
			IdleTimeout:  time.Duration(getEnvAsInt("IDLE_TIMEOUT", 60)) * time.Second,
		},
		Executor: ExecutorConfig{
			ConcurrentExecutions: getEnvAsInt("CONCURRENT_EXECUTIONS", 5),
			QueueCapacity:        getEnvAsInt("QUEUE_CAPACITY", 100),
			DefaultTimeout:       time.Duration(getEnvAsInt("DEFAULT_TIMEOUT", 30)) * time.Second,
		},
		Languages: getLanguageConfigs(),
		Sandbox: SandboxConfig{
			NetworkDisabled: getEnvAsBool("SANDBOX_NETWORK_DISABLED", true),
			MemorySwapLimit: getEnv("SANDBOX_MEMORY_SWAP_LIMIT", "0"),
			PidsLimit:       int64(getEnvAsInt("SANDBOX_PIDS_LIMIT", 50)),
		},
	}
}

// getLanguageConfigs returns configurations for all supported languages
func getLanguageConfigs() map[string]LanguageConfig {
	return map[string]LanguageConfig{
		"python": {
			Name:        "Python",
			Image:       "python:3.9-slim",
			MemoryLimit: "100m",
			CPULimit:    "0.1",
			TimeoutSec:  30,
			RunCmd:      []string{"python", "-c"},
			FileExt:     ".py",
			VersionCmd:  []string{"python", "--version"},
		},
		"java": {
			Name:        "Java",
			Image:       "eclipse-temurin:11-jdk",
			MemoryLimit: "400m",
			CPULimit:    "0.5",
			TimeoutSec:  100,
			CompileCmd:  []string{"javac"},
			RunCmd:      []string{"java"},
			FileExt:     ".java",
			VersionCmd:  []string{"java", "-version"},
		},
		"c": {
			Name:        "C",
			Image:       "gcc:latest",
			MemoryLimit: "100m",
			CPULimit:    "0.1",
			TimeoutSec:  30,
			CompileCmd:  []string{"gcc", "-o", "program"},
			RunCmd:      []string{"./program"},
			FileExt:     ".c",
			VersionCmd:  []string{"gcc", "--version"},
		},
		"cpp": {
			Name:        "C++",
			Image:       "gcc:latest",
			MemoryLimit: "100m",
			CPULimit:    "0.1",
			TimeoutSec:  30,
			CompileCmd:  []string{"g++", "-o", "program"},
			RunCmd:      []string{"./program"},
			FileExt:     ".cpp",
			VersionCmd:  []string{"g++", "--version"},
		},
		"javascript": {
			Name:        "JavaScript",
			Image:       "node:16-alpine",
			MemoryLimit: "100m",
			CPULimit:    "0.1",
			TimeoutSec:  30,
			RunCmd:      []string{"node", "-e"},
			FileExt:     ".js",
			VersionCmd:  []string{"node", "--version"},
		},
		"golang": {
			Name:        "Go",
			Image:       "golang:1.19-alpine",
			MemoryLimit: "100m",
			CPULimit:    "0.1",
			TimeoutSec:  30,
			CompileCmd:  []string{"go", "build", "-o", "program"},
			RunCmd:      []string{"./program"},
			FileExt:     ".go",
			VersionCmd:  []string{"go", "version"},
		},
	}
}

// Helper functions to get environment variables with defaults
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := getEnv(key, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	valueStr := getEnv(key, "")
	if value, err := strconv.ParseBool(valueStr); err == nil {
		return value
	}
	return defaultValue
}
