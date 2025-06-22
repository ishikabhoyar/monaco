package utils

import (
	"log"
	"os"
	"os/exec"
	"regexp"
	"strings"
)

// DockerAvailable checks if Docker is available on the system
func DockerAvailable() bool {
	cmd := exec.Command("docker", "--version")
	if err := cmd.Run(); err != nil {
		log.Printf("Docker not available: %v", err)
		return false
	}
	return true
}

// PullDockerImage pulls a Docker image if it doesn't exist
func PullDockerImage(image string) error {
	// Check if image exists
	checkCmd := exec.Command("docker", "image", "inspect", image)
	if err := checkCmd.Run(); err == nil {
		// Image exists
		return nil
	}

	// Pull the image
	log.Printf("Pulling Docker image: %s", image)
	pullCmd := exec.Command("docker", "pull", image)
	pullCmd.Stdout = os.Stdout
	pullCmd.Stderr = os.Stderr
	return pullCmd.Run()
}

// ExtractJavaClassName extracts the class name from Java code
func ExtractJavaClassName(code string) string {
	// Default class name as fallback
	defaultClass := "Solution"

	// Look for public class
	re := regexp.MustCompile(`public\s+class\s+(\w+)`)
	matches := re.FindStringSubmatch(code)
	if len(matches) > 1 {
		return matches[1]
	}

	// Look for any class if no public class
	re = regexp.MustCompile(`class\s+(\w+)`)
	matches = re.FindStringSubmatch(code)
	if len(matches) > 1 {
		return matches[1]
	}

	return defaultClass
}

// IsInputPrompt determines if a string is likely an input prompt
func IsInputPrompt(text string) bool {
	// Early exit for empty or very long text
	text = strings.TrimSpace(text)
	if text == "" || len(text) > 100 {
		return false
	}

	// Common prompt endings
	if strings.HasSuffix(text, ":") || strings.HasSuffix(text, ">") || 
	   strings.HasSuffix(text, "?") || strings.HasSuffix(text, "...") {
		return true
	}

	// Common prompt words
	promptWords := []string{"input", "enter", "type", "provide"}
	for _, word := range promptWords {
		if strings.Contains(strings.ToLower(text), word) {
			return true
		}
	}

	return false
}

// SanitizeDockerArgs ensures safe Docker command arguments
func SanitizeDockerArgs(args []string) []string {
	// This is a simplified version - in production, you'd want more robust checks
	sanitized := make([]string, 0, len(args))
	
	// Disallow certain dangerous flags
	dangerousFlags := map[string]bool{
		"--privileged": true,
		"--net=host":   true,
		"--pid=host":   true,
		"--ipc=host":   true,
		"--userns=host": true,
	}
	
	for _, arg := range args {
		if _, isDangerous := dangerousFlags[arg]; !isDangerous {
			sanitized = append(sanitized, arg)
		}
	}
	
	return sanitized
}
