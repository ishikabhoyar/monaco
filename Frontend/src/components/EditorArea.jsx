import React from "react";
import { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { 
  X, Plus, Save, FileCode, FileText, Folder, ChevronDown, ChevronRight,
  File, FilePlus, FolderPlus, Trash2, Edit, MoreHorizontal, Play, 
  Terminal, Loader
} from "lucide-react";
import Sidebar from "./Sidebar";
import Panel from "./Panel";  // Import Panel component

// Add this function to map file extensions to language identifiers
const getLanguageFromExtension = (extension) => {
  const extensionMap = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'go': 'go',
    'rb': 'ruby',
    'php': 'php',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown'
  };
  
  return extensionMap[extension] || 'text';
};

const EditorArea = ({ 
  sidebarVisible = true, 
  activeView = "explorer",
  panelVisible,
  setPanelVisible 
}) => {
  // Store files with their content in state - start with just README.md
  const [files, setFiles] = useState([
    { id: "README.md", language: "markdown", content: getDefaultCode("README.md") },
  ]);
  
  const [activeTab, setActiveTab] = useState(files[0]?.id || "");
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileType, setNewFileType] = useState("javascript");
  const [unsavedChanges, setUnsavedChanges] = useState({});
  
  // Sidebar state - now receives visibility from props
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [fileStructure, setFileStructure] = useState({
    'src': {
      type: 'folder',
      children: {}
    },
    'README.md': {
      type: 'file',
      language: 'markdown',
      id: 'README.md'
    }
  });

  // Context menu state
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuTarget, setContextMenuTarget] = useState(null);
  
  const editorRef = useRef(null);
  const newFileInputRef = useRef(null);
  const renameInputRef = useRef(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renamePath, setRenamePath] = useState('');
  const [renameValue, setRenameValue] = useState('');

  // Replace terminal states with panel states
  const [isRunning, setIsRunning] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [panelHeight, setPanelHeight] = useState(200);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [activeRunningFile, setActiveRunningFile] = useState(null);

  // Add a new state for user input
  const [userInput, setUserInput] = useState("");
  // Add socket state to track the connection
  const [activeSocket, setActiveSocket] = useState(null);

  // Focus the input when new file modal opens
  useEffect(() => {
    if (isNewFileModalOpen && newFileInputRef.current) {
      newFileInputRef.current.focus();
    }
  }, [isNewFileModalOpen]);

  // Focus rename input when renaming
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [isRenaming]);

  // Load files and file structure from localStorage on component mount
  useEffect(() => {
    const savedFiles = localStorage.getItem("vscode-clone-files");
    const savedFileStructure = localStorage.getItem("vscode-clone-structure");
    
    if (savedFiles) {
      try {
        const parsedFiles = JSON.parse(savedFiles);
        setFiles(parsedFiles);
        if (parsedFiles.length > 0) {
          setActiveTab(parsedFiles[0].id);
        }
      } catch (error) {
        console.error("Failed to load saved files:", error);
      }
    }
    
    if (savedFileStructure) {
      try {
        const parsedStructure = JSON.parse(savedFileStructure);
        setFileStructure(parsedStructure);
      } catch (error) {
        console.error("Failed to load file structure:", error);
      }
    }
  }, []);

  // Save files and file structure to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("vscode-clone-files", JSON.stringify(files));
  }, [files]);
  // Add this effect to handle editor resize when sidebar changes
  useEffect(() => {
    // Force editor to readjust layout when sidebar visibility changes
    if (editorRef.current) {
      setTimeout(() => {
        editorRef.current.layout();
      }, 300); // Small delay to allow transition to complete
    }
  }, [sidebarVisible]);

  // Add this effect to sync the panel state with parent component
  useEffect(() => {
    if (panelVisible !== undefined) {
      setShowPanel(panelVisible);
    }
  }, [panelVisible]);

  // Add this useEffect for cleanup
  useEffect(() => {
    // Cleanup function to close socket when component unmounts
    return () => {
      if (activeSocket) {
        activeSocket.close();
      }
    };
  }, []);

  // Add interval to poll execution status
  useEffect(() => {
    const checkInterval = setInterval(() => {
      // Poll execution status
      if (activeSocket && activeRunningFile) {
        // Check if socket is still connected
        if (activeSocket.readyState !== WebSocket.OPEN) {
          console.warn("Socket not in OPEN state:", activeSocket.readyState);
          setTerminalOutput(prev => [...prev, { 
            type: 'warning', 
            content: `Terminal connection lost, attempting to reconnect...` 
          }]);
          // Could implement reconnection logic here
        }
      }
    }, 5000);

    // Clean up interval when component unmounts
    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [activeSocket, activeRunningFile]);

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
  };

  const handleEditorChange = (value) => {
    // Mark the current file as having unsaved changes
    setUnsavedChanges(prev => ({
      ...prev,
      [activeTab]: true
    }));
    
    // Update the file content in the files array
    setFiles(files.map(file => 
      file.id === activeTab ? { ...file, content: value } : file
    ));
  };

  const handleCloseTab = (e, fileId) => {
    e.stopPropagation();
    
    if (unsavedChanges[fileId]) {
      if (!confirm(`You have unsaved changes in ${fileId}. Close anyway?`)) {
        return;
      }
    }
    
    // Remove the file from the files array
    const newFiles = files.filter(file => file.id !== fileId);
    setFiles(newFiles);
    
    // Update unsavedChanges
    const newUnsavedChanges = { ...unsavedChanges };
    delete newUnsavedChanges[fileId];
    setUnsavedChanges(newUnsavedChanges);
    
    // If the active tab is closed, set a new active tab
    if (activeTab === fileId && newFiles.length > 0) {
      setActiveTab(newFiles[0].id);
    }
  };

  const handleCreateNewFile = (e, path = '') => {
    e?.preventDefault();
    
    if (!newFileName) return;
    
    const filePath = path ? `${path}/${newFileName}` : newFileName;
    
    // Check if file already exists
    if (files.some(file => file.id === filePath)) {
      alert(`A file named "${filePath}" already exists.`);
      return;
    }
    
    // Determine language based on file extension
    let language = newFileType;
    const extension = newFileName.split('.').pop().toLowerCase();
    if (['jsx', 'js', 'ts', 'tsx'].includes(extension)) {
      language = 'javascript';
    } else if (['css', 'scss', 'less'].includes(extension)) {
      language = 'css';
    } else if (['html', 'htm'].includes(extension)) {
      language = 'html';
    } else if (['json'].includes(extension)) {
      language = 'json';
    } else if (['md', 'markdown'].includes(extension)) {
      language = 'markdown';
    }
    
    // Create new file
    const newFile = {
      id: filePath,
      language,
      content: ''
    };
    
    setFiles([...files, newFile]);
    setActiveTab(filePath);
    
    // Update file structure
    updateFileStructure(filePath, 'file', language);
    
    setNewFileName('');
    setIsNewFileModalOpen(false);
  };

  const updateFileStructure = (path, type, language = null) => {
    const parts = path.split('/');
    const fileName = parts.pop();
    let current = fileStructure;
    
    // Navigate to the correct folder
    if (parts.length > 0) {
      for (const part of parts) {
        if (!current[part]) {
          current[part] = { type: 'folder', children: {} };
        }
        current = current[part].children;
      }
    }
    
    // Add the new item to the structure
    if (type === 'file') {
      current[fileName] = { type: 'file', language, id: path };
    } else if (type === 'folder') {
      current[fileName] = { type: 'folder', children: {} };
    }
    
    // Update the state with the new structure
    setFileStructure({...fileStructure});
  };

  const createNewFolder = (path = '') => {
    const folderName = prompt("Enter folder name:");
    if (!folderName) return;
    
    const folderPath = path ? `${path}/${folderName}` : folderName;
    updateFileStructure(folderPath, 'folder');
    
    // If the folder is inside another folder, expand the parent
    if (path) {
      setExpandedFolders({
        ...expandedFolders,
        [path]: true
      });
    }
  };

  const handleSaveFile = () => {
    // Mark current file as saved
    setUnsavedChanges(prev => ({
      ...prev,
      [activeTab]: false
    }));
    
    // In a real app, you would save to the server here
    console.log(`File ${activeTab} saved!`);
  };

  const toggleFolder = (folderPath) => {
    setExpandedFolders({
      ...expandedFolders,
      [folderPath]: !expandedFolders[folderPath]
    });
  };

  const openFile = (fileId) => {
    // Check if file exists in files array
    const fileExists = files.some(file => file.id === fileId);
    
    if (!fileExists) {
      // Determine language from file structure
      let language = 'text';
      const parts = fileId.split('/');
      const fileName = parts.pop();
      const extension = fileName.split('.').pop().toLowerCase();
      
      if (['jsx', 'js', 'ts', 'tsx'].includes(extension)) {
        language = 'javascript';
      } else if (['css', 'scss', 'less'].includes(extension)) {
        language = 'css';
      } else if (['html', 'htm'].includes(extension)) {
        language = 'html';
      } else if (['json'].includes(extension)) {
        language = 'json';
      } else if (['md', 'markdown'].includes(extension)) {
        language = 'markdown';
      }
      
      // Create new file entry
      const newFile = {
        id: fileId,
        language,
        content: ''
      };
      
      setFiles([...files, newFile]);
    }
    
    setActiveTab(fileId);
  };

  const handleContextMenu = (e, path, type) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuTarget({ path, type });
    setShowContextMenu(true);
  };

  const closeContextMenu = () => {
    setShowContextMenu(false);
    setContextMenuTarget(null);
  };

  const deleteItem = (path, type) => {
    const confirmDelete = confirm(`Are you sure you want to delete ${path}?`);
    if (!confirmDelete) return;
    
    if (type === 'file') {
      // Remove from files array
      setFiles(files.filter(file => file.id !== path));
      
      // If it was active, set a new active tab
      if (activeTab === path) {
        const newActiveTab = files.find(file => file.id !== path)?.id || '';
        setActiveTab(newActiveTab);
      }
      
      // Remove from unsavedChanges
      const newUnsavedChanges = { ...unsavedChanges };
      delete newUnsavedChanges[path];
      setUnsavedChanges(newUnsavedChanges);
    }
    
    // Remove from file structure
    const parts = path.split('/');
    const itemName = parts.pop();
    let current = fileStructure;
    let parent = null;
    
    // Navigate to the correct folder
    if (parts.length > 0) {
      for (const part of parts) {
        parent = current;
        current = current[part].children;
      }
      
      // Delete the item
      delete current[itemName];
    } else {
      // Delete top-level item
      delete fileStructure[itemName];
    }
    
    // Update the state
    setFileStructure({...fileStructure});
  };

  const startRenaming = (path, type) => {
    setRenamePath(path);
    
    const parts = path.split('/');
    const currentName = parts.pop();
    setRenameValue(currentName);
    
    setIsRenaming(true);
  };

  const handleRename = (e) => {
    e.preventDefault();
    
    if (!renameValue.trim()) return;
    
    const parts = renamePath.split('/');
    const oldName = parts.pop();
    const parentPath = parts.join('/');
    const newPath = parentPath ? `${parentPath}/${renameValue}` : renameValue;
    
    // Check if this would overwrite an existing file or folder
    const parts2 = newPath.split('/');
    const newName = parts2.pop();
    let current = fileStructure;
    
    // Navigate to parent folder
    for (let i = 0; i < parts2.length; i++) {
      current = current[parts2[i]].children;
    }
    
    if (current[newName] && renamePath !== newPath) {
      alert(`An item named "${newName}" already exists at this location.`);
      return;
    }
    
    // Get the object data
    const pathParts = renamePath.split('/');
    let curr = fileStructure;
    for (let i = 0; i < pathParts.length - 1; i++) {
      curr = curr[pathParts[i]].children;
    }
    const item = curr[pathParts[pathParts.length - 1]];
    
    // Delete from old location
    delete curr[pathParts[pathParts.length - 1]];
    
    // Add to new location
    const newParts = newPath.split('/');
    curr = fileStructure;
    for (let i = 0; i < newParts.length - 1; i++) {
      curr = curr[newParts[i]].children;
    }
    curr[newParts[newParts.length - 1]] = item;
    
    // If it's a file, update the files array
    if (item.type === 'file') {
      const fileIndex = files.findIndex(file => file.id === renamePath);
      if (fileIndex !== -1) {
        const updatedFiles = [...files];
        updatedFiles[fileIndex] = {
          ...updatedFiles[fileIndex],
          id: newPath
        };
        setFiles(updatedFiles);
        
        // Update active tab if necessary
        if (activeTab === renamePath) {
          setActiveTab(newPath);
        }
        
        // Update unsavedChanges
        if (unsavedChanges[renamePath]) {
          const newUnsavedChanges = { ...unsavedChanges };
          newUnsavedChanges[newPath] = newUnsavedChanges[renamePath];
          delete newUnsavedChanges[renamePath];
          setUnsavedChanges(newUnsavedChanges);
        }
      }
    }
    
    setFileStructure({...fileStructure});
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setIsRenaming(false);
    setRenamePath('');
    setRenameValue('');
  };

  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    if (['jsx', 'js', 'ts', 'tsx'].includes(extension)) {
      return <FileCode size={14} className="mr-1 text-yellow-400" />;
    } else if (['css', 'scss', 'less'].includes(extension)) {
      return <FileCode size={14} className="mr-1 text-blue-400" />;
    } else if (['html', 'htm'].includes(extension)) {
      return <FileCode size={14} className="mr-1 text-orange-400" />;
    } else if (['md', 'markdown'].includes(extension)) {
      return <FileText size={14} className="mr-1 text-white" />;
    }
    return <FileText size={14} className="mr-1" />;
  };

  function getDefaultCode(tabId) {
    switch (tabId) {
      case "README.md":
        return `# VS Code Clone Project

## Authors
- Arnab Bhowmik
- Ishika Bhoyar

## Description
This project is a VS Code Clone built with React and Monaco Editor. It features a file tree navigation, tab management, code editing with syntax highlighting, and a terminal panel for running code. It mimics the core functionalities of Visual Studio Code in a browser-based environment.

## Frontend Functionalities
- Built with React and Monaco Editor.
- File tree navigation for managing files and folders.
- Tab management for opening multiple files simultaneously.
- Code editing with syntax highlighting and language support.
- Terminal panel for running code and viewing output.
- Persistent file structure and content using localStorage.

## Backend Functionalities
- Built with Go and Docker for secure code execution.
- Supports multiple programming languages (Python, Java, C/C++).
- Executes code in isolated Docker containers with resource limits.
- RESTful API for submitting code, checking status, and retrieving results.
- Job queue system for managing concurrent executions.
- Enforces timeouts and resource limits for security and performance.
`;


      default:
        return "";
    }
  }

  const activeFile = files.find(file => file.id === activeTab);
  
  // Calculate editor area style based on sidebar visibility
  const editorAreaStyle = {
    marginLeft: sidebarVisible ? `${sidebarWidth}px` : '0px',
    width: `calc(100% - ${sidebarVisible ? sidebarWidth : 0}px)`
  };

  // Update the handleRunCode function
  const handleRunCode = async () => {
    if (!activeFile) return;
    
    // Show the panel
    setShowPanel(true);
    if (setPanelVisible) {
      setPanelVisible(true);
    }
    
    // Clear previous output and add new command
    const fileExtension = activeFile.id.split('.').pop().toLowerCase();
    const language = getLanguageFromExtension(fileExtension);
    
    const newOutput = [
      { type: 'command', content: `$ run ${activeFile.id}` },
      { type: 'output', content: 'Submitting code...' }
    ];
    setTerminalOutput(newOutput);
    
    try {
      // Close any existing socket
      if (activeSocket) {
        activeSocket.close();
        setActiveSocket(null);
      }
      
      // Use API URL from environment variable
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      
      // Submit the code to get an execution ID
      const submitResponse = await fetch(`${apiUrl}/api/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: language,
          code: activeFile.content,
          input: ""  // Explicitly passing empty input, no user input handling
        }),
      });
      
      if (!submitResponse.ok) {
        throw new Error(`Server error: ${submitResponse.status}`);
      }
      
      const { id } = await submitResponse.json();
      setTerminalOutput(prev => [...prev, { type: 'output', content: `Job submitted with ID: ${id}` }]);
      
      // Set active running file
      setActiveRunningFile(activeFile.id);
      
      // Connect to WebSocket with the execution ID
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsBaseUrl = apiUrl.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}//${wsBaseUrl}/api/ws/terminal/${id}`;
      
      setTerminalOutput(prev => [...prev, { type: 'output', content: `Connecting to: ${wsUrl}` }]);
      
      // Create a new WebSocket
      const newSocket = new WebSocket(wsUrl);
      
      // Set up event handlers
      newSocket.onopen = () => {
        console.log("WebSocket connected");
        setTerminalOutput(prev => [...prev, { type: 'output', content: 'Connected to execution terminal' }]);
        setIsRunning(true);
      };
      
      newSocket.onmessage = (event) => {
        console.log("WebSocket message received:", event.data);
        
        try {
          const message = JSON.parse(event.data);
          
          // Handle different message types
          switch (message.type) {
            case 'output':
              setTerminalOutput(prev => [...prev, { 
                type: 'output', 
                content: message.content.text,
                isError: message.content.isError 
              }]);
              break;
            
            case 'status':
              const status = message.content.status;
              setTerminalOutput(prev => [...prev, { 
                type: 'status', 
                content: `Status: ${status}` 
              }]);
              
              // Update running state based on status
              if (status === 'completed' || status === 'failed') {
                // Don't immediately set isRunning to false - we'll wait for the socket to close or delay
              }
              break;
            
            case 'system':
              setTerminalOutput(prev => [...prev, { 
                type: 'system', 
                content: message.content
              }]);
              break;
              
            case 'error':
              setTerminalOutput(prev => [...prev, { 
                type: 'error', 
                content: `Error: ${message.content.message}`
              }]);
              break;
              
            default:
              // For raw or unknown messages
              setTerminalOutput(prev => [...prev, { 
                type: 'output', 
                content: event.data
              }]);
          }
          
          // Check if this message is likely asking for input (prompt detection)
          if (message.type === 'output' && !message.content.isError && 
              (message.content.text.includes("?") || 
               message.content.text.endsWith(":") || 
               message.content.text.endsWith("> "))) {
            console.log("Input prompt detected, focusing terminal");
            // Force terminal to focus after a prompt is detected
            setTimeout(() => {
              document.querySelector('.panel-terminal')?.focus();
            }, 100);
          }
          
        } catch (err) {
          // Handle case where message isn't valid JSON
          console.warn("Failed to parse WebSocket message:", err);
          setTerminalOutput(prev => [...prev, { 
            type: 'output', 
            content: event.data 
          }]);
        }
      };

      // Add polling for job status
      let statusCheckInterval;
      if (id) {
        // Start polling the status endpoint every 2 seconds
        statusCheckInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`${apiUrl}/api/status/${id}`);
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              
              // If the process is completed or failed, stop polling and update UI
              if (statusData.status === 'completed' || statusData.status === 'failed') {
                clearInterval(statusCheckInterval);
                console.log("Process status:", statusData.status);
                
                // Update the UI to show process is no longer running
                setIsRunning(false);
                
                // Display the final result if WebSocket didn't capture it
                if (statusData.output && statusData.output.length > 0) {
                  setTerminalOutput(prev => {
                    // Check if the output is already in the terminal
                    const lastOutput = prev[prev.length - 1]?.content || "";
                    if (!lastOutput.includes(statusData.output)) {
                      return [...prev, { 
                        type: 'output', 
                        content: `\n[System] Final output:\n${statusData.output}` 
                      }];
                    }
                    return prev;
                  });
                }
                
                // Close socket if it's still open
                if (newSocket && newSocket.readyState === WebSocket.OPEN) {
                  newSocket.close();
                }
              }
            }
          } catch (error) {
            console.error("Status check error:", error);
          }
        }, 2000);
        
        // Clean up interval when component unmounts or when socket closes
        newSocket.addEventListener('close', () => {
          if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
          }
        });
      }
      
      newSocket.onclose = (event) => {
        console.log("WebSocket closed:", event);
        
        const reason = event.reason ? `: ${event.reason}` : '';
        const code = event.code ? ` (code: ${event.code})` : '';
        
        // Don't mark as not running if this is expected close (after execution completes)
        // Code 1000 is normal closure, 1005 is no status code
        const isExpectedClose = event.code === 1000 || event.code === 1005;
        
        // Only set running to false if it wasn't an expected close
        if (!isExpectedClose) {
          setIsRunning(false);
          
          // Add a graceful reconnection message
          setTerminalOutput(prev => [...prev, { 
            type: 'warning', 
            content: `Terminal connection closed${reason}${code}` 
          }]);
          
          // Attempt reconnection for certain close codes (unexpected closes)
          if (activeRunningFile && event.code !== 1000) {
            setTerminalOutput(prev => [...prev, { 
              type: 'info', 
              content: `Attempting to reconnect...` 
            }]);
            
            // Reconnection delay
            setTimeout(() => {
              // Attempt to reconnect for the same file
              if (activeRunningFile) {
                console.log("Attempting to reconnect for", activeRunningFile);
                // You could call your run function here again
              }
            }, 3000);
          }
        }
        
        setActiveSocket(null);
        
        // Clean up interval
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
        }
      };
      
      newSocket.onerror = (event) => {
        console.error("WebSocket error:", event);
        setTerminalOutput(prev => [...prev, { 
          type: 'warning', 
          content: `WebSocket error occurred` 
        }]);
      };
      
      // Set the active socket after all handlers are defined
      setActiveSocket(newSocket);
      
    } catch (error) {
      console.error("Run code error:", error);
      setTerminalOutput(prev => [...prev, { type: 'warning', content: `Error: ${error.message}` }]);
      setIsRunning(false);
      
      // Also add cleanup in the error handler
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
    }
  };

  // Update handleInputSubmit to ensure the input is sent properly
  const handleInputSubmit = (input) => {
    // Use the direct input parameter instead of relying on userInput state
    const textToSend = input || userInput;
    
    console.log("Input submit called, active socket state:", 
      activeSocket ? activeSocket.readyState : "no socket", 
      "input:", textToSend);
    
    if (!activeSocket) {
      console.warn("Cannot send input: No active socket");
      setTerminalOutput(prev => [...prev, { 
        type: 'warning', 
        content: `Cannot send input: No active connection` 
      }]);
      return;
    }
    
    if (activeSocket.readyState !== WebSocket.OPEN) {
      console.warn("Socket not in OPEN state:", activeSocket.readyState);
      setTerminalOutput(prev => [...prev, { 
        type: 'warning', 
        content: `Cannot send input: Connection not open (state: ${activeSocket.readyState})` 
      }]);
      return;
    }
    
    try {
      // Add the input to the terminal display
      setTerminalOutput(prev => [...prev, { type: 'command', content: `> ${textToSend}` }]);
      
      // Send the input via WebSocket
      console.log("Sending input:", textToSend);
      
      // Instead of just sending the raw input, send a formatted input message
      // This helps the backend identify it as user input rather than a command
      activeSocket.send(JSON.stringify({
        type: "input",
        content: textToSend
      }));
      
      // Clear the input field
      setUserInput("");
    } catch (error) {
      console.error("Error sending input:", error);
      setTerminalOutput(prev => [...prev, { 
        type: 'warning', 
        content: `Error sending input: ${error.message}` 
      }]);
    }
  };

  // Update this function to also update parent state
  const togglePanel = () => {
    const newState = !showPanel;
    setShowPanel(newState);
    if (setPanelVisible) {
      setPanelVisible(newState);
    }
  };

  // Add this function above the return statement
  const handleDownloadFile = () => {
    if (!activeFile) return;
    
    // Create a blob with the file content
    const blob = new Blob([activeFile.content], { type: 'text/plain' });
    
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Create a temporary anchor element
    const a = document.createElement('a');
    a.href = url;
    
    // Get just the filename without path
    const fileName = activeFile.id.includes('/') ? 
      activeFile.id.split('/').pop() : 
      activeFile.id;
    
    // Set the download attribute with the filename
    a.download = fileName;
    
    // Append to the document, click it, and then remove it
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Release the object URL
    URL.revokeObjectURL(url);
  };

  return (
    <div className="editor-container">
      {sidebarVisible && (
        <Sidebar
          activeView={activeView}
          width={sidebarWidth}
          fileStructure={fileStructure}
          expandedFolders={expandedFolders}
          setExpandedFolders={setExpandedFolders}
          handleContextMenu={handleContextMenu}
          openFile={openFile}
          unsavedChanges={unsavedChanges}
          activeTab={activeTab}
          isRenaming={isRenaming}
          renamePath={renamePath}
          renameValue={renameValue}
          handleRename={handleRename}
          renameInputRef={renameInputRef}
          cancelRename={cancelRename}
          setIsNewFileModalOpen={setIsNewFileModalOpen}
          createNewFolder={createNewFolder}
        />
      )}
      
      <div className="editor-area" style={editorAreaStyle}>
        <div className="editor-header">
          <div className="editor-tabs">
            {files.map((file) => {
              // Extract just the filename without path for display
              const displayName = file.id.includes('/') ? 
                file.id.split('/').pop() : 
                file.id;
                
              return (
                <div
                  key={file.id}
                  className={`editor-tab ${activeTab === file.id ? "active" : ""}`}
                  onClick={() => setActiveTab(file.id)}
                  title={file.id} // Show full path on hover
                >
                  <span className="tab-name">
                    {getFileIcon(file.id)}
                    {displayName} {/* Show just filename, not full path */}
                    {unsavedChanges[file.id] && ' •'}
                  </span>
                  <button 
                    className="tab-close" 
                    onClick={(e) => handleCloseTab(e, file.id)}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
            <button 
              className="editor-tab-new"
              onClick={() => setIsNewFileModalOpen(true)}
              title="Create new file"
            >
              <Plus size={14} />
            </button>
          </div>
          
          {/* Run controls */}
          <div className="editor-run-controls">
            {activeFile && (
              <>
                <button 
                  className="run-button"
                  onClick={handleRunCode}
                  disabled={isRunning}
                  title="Run code"
                >
                  {isRunning ? <Loader size={16} className="animate-spin" /> : <Play size={16} />}
                  
                </button>
                <button 
                  className="terminal-toggle-button"
                  onClick={togglePanel} // Use the new function
                  title="Toggle terminal"
                >
                  <Terminal size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="monaco-container" style={{ 
          height: showPanel ? `calc(100% - ${panelHeight}px - 30px)` : "100%" 
        }}>
          {activeFile ? (
            <Editor
              height="100%"
              defaultLanguage={activeFile.language}
              language={activeFile.language}
              value={activeFile.content}
              theme="vs-dark"
              onMount={handleEditorDidMount}
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                fontSize: 14,
                lineNumbers: "on",
                renderLineHighlight: "all",
                automaticLayout: true,
              }}
            />
          ) : (
            <div className="empty-editor-message">
              <p>No file open. Create a new file or select a file to start editing.</p>
            </div>
          )}
        </div>

        {/* Use Panel component instead of internal terminal */}
        {showPanel && (
          <>
            <div
              className="resize-handle resize-handle-horizontal"
              onMouseDown={(e) => {
                const startY = e.clientY;
                const startHeight = panelHeight;

                const onMouseMove = (moveEvent) => {
                  const newHeight = startHeight - (moveEvent.clientY - startY);
                  if (newHeight > 100 && newHeight < 500) {
                    setPanelHeight(newHeight);
                  }
                };

                const onMouseUp = () => {
                  document.removeEventListener("mousemove", onMouseMove);
                  document.removeEventListener("mouseup", onMouseUp);
                };

                document.addEventListener("mousemove", onMouseMove);
                document.addEventListener("mouseup", onMouseUp);
              }}
            />
           <Panel 
            height={panelHeight}
            terminalOutput={terminalOutput}
            isRunning={isRunning}
            activeRunningFile={activeRunningFile}
            initialTab="terminal"
            onClose={togglePanel}
            userInput={userInput}
            onUserInputChange={setUserInput}
            onInputSubmit={handleInputSubmit}
          />
          </>
        )}

        {/* Modify the editor-actions div to include the download button */}
        <div className="editor-actions">
          <button 
            className="editor-action-button"
            onClick={handleSaveFile}
            disabled={!activeTab || !unsavedChanges[activeTab]}
            title="Save file"
          >
            <Save size={16} />
          </button>
          
          {/* Add download button */}
          <button 
            className="editor-action-button"
            onClick={handleDownloadFile}
            disabled={!activeTab}
            title="Download file"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        </div>

        {isNewFileModalOpen && (
          <div className="modal-overlay">
            <div className="new-file-modal">
              <h3>Create New File</h3>
              <form onSubmit={handleCreateNewFile}>
                <input
                  ref={newFileInputRef}
                  type="text"
                  placeholder="File name (e.g., NewFile.jsx)"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                />
                <div className="modal-actions">
                  <button type="button" onClick={() => setIsNewFileModalOpen(false)}>Cancel</button>
                  <button type="submit">Create</button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Context Menu */}
        {showContextMenu && (
          <div 
            className="context-menu"
            style={{
              position: 'fixed',
              top: contextMenuPosition.y,
              left: contextMenuPosition.x
            }}
          >
            {contextMenuTarget?.type === 'folder' && (
              <>
                <div className="context-menu-item" onClick={() => {
                  createNewFolder(contextMenuTarget.path);
                  closeContextMenu();
                }}>
                  <FolderPlus size={14} className="mr-1" />
                  New Folder
                </div>
                <div className="context-menu-item" onClick={() => {
                  setNewFileName('');
                  setIsNewFileModalOpen(true);
                  closeContextMenu();
                }}>
                  <FilePlus size={14} className="mr-1" />
                  New File
                </div>
              </>
            )}
            <div className="context-menu-item" onClick={() => {
              startRenaming(contextMenuTarget.path, contextMenuTarget.type);
              closeContextMenu();
            }}>
              <Edit size={14} className="mr-1" />
              Rename
            </div>

            {/* Add download option - only show for files */}
            {contextMenuTarget?.type === 'file' && (
              <div className="context-menu-item" onClick={() => {
                // Find the file in the files array
                const file = files.find(f => f.id === contextMenuTarget.path);
                if (file) {
                  // Create a blob with the file content
                  const blob = new Blob([file.content], { type: 'text/plain' });
                  
                  // Create a URL for the blob
                  const url = URL.createObjectURL(blob);
                  
                  // Create a temporary anchor element
                  const a = document.createElement('a');
                  a.href = url;
                  
                  // Get just the filename without path
                  const fileName = file.id.includes('/') ? 
                    file.id.split('/').pop() : 
                    file.id;
                  
                  // Set the download attribute with the filename
                  a.download = fileName;
                  
                  // Append to the document, click it, and then remove it
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  
                  // Release the object URL
                  URL.revokeObjectURL(url);
                }
                closeContextMenu();
              }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download
            </div>
            )}

            <div className="context-menu-item delete" onClick={() => {
              deleteItem(contextMenuTarget.path, contextMenuTarget.type);
              closeContextMenu();
            }}>
              <Trash2 size={14} className="mr-1" />
              Delete
            </div>
          </div>
        )}
      </div>
      
      {showContextMenu && (
        <div 
          className="context-menu-overlay"
          onClick={closeContextMenu}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
        />
      )}
    </div>
  );
};

export default EditorArea;

