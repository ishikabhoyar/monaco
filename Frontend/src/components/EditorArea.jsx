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
  
  useEffect(() => {
    localStorage.setItem("vscode-clone-structure", JSON.stringify(fileStructure));
  }, [fileStructure]);

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

## Overview
This is a simple VS Code clone built with React and Monaco Editor.

## Features
- File tree navigation
- Tab management
- Code editing with Monaco Editor
- Syntax highlighting

## Getting Started
1. Create a new file using the + button in the sidebar
2. Edit your code in the editor
3. Save changes using the save button

Happy coding!`;
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

  // Update the run code function to work with backend
  const handleRunCode = async () => {
    if (!activeFile) return;
    
    // Show the panel
    setShowPanel(true);
    if (setPanelVisible) {
      setPanelVisible(true);
    }
    
    // Set running state
    setIsRunning(true);
    setActiveRunningFile(activeFile.id);
    
    // Clear previous output and add new command
    const fileExtension = activeFile.id.split('.').pop().toLowerCase();
    const language = getLanguageFromExtension(fileExtension);
    
    const newOutput = [
      { type: 'command', content: `$ run ${activeFile.id}` }
    ];
    setTerminalOutput(newOutput);

    // Use API URL from environment variable
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';

    try {
      // Step 1: Submit code to backend
      const submitResponse = await fetch(`${apiUrl}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: language,
          code: activeFile.content
        }),
      });
      
      if (!submitResponse.ok) {
        throw new Error(`Server error: ${submitResponse.status}`);
      }
      
      const { id } = await submitResponse.json();
      setTerminalOutput(prev => [...prev, { type: 'output', content: `Job submitted with ID: ${id}` }]);
      
      // Step 2: Poll for status until completed or failed
      let status = 'pending';
      while (status !== 'completed' && status !== 'failed') {
        // Add a small delay between polls
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await fetch(`${apiUrl}/status?id=${id}`);
        if (!statusResponse.ok) {
          throw new Error(`Status check failed: ${statusResponse.status}`);
        }
        
        const statusData = await statusResponse.json();
        status = statusData.status;
        
        // Update terminal with status (for any status type)
        setTerminalOutput(prev => {
          // Update the last status message or add a new one
          const hasStatus = prev.some(line => line.content.includes('Status:'));
          if (hasStatus) {
            return prev.map(line => 
              line.content.includes('Status:') 
                ? { ...line, content: `Status: ${status}` } 
                : line
            );
          } else {
            return [...prev, { type: 'output', content: `Status: ${status}` }];
          }
        });
      }
      
      // Get the result for both completed and failed status
      const resultResponse = await fetch(`${apiUrl}/result?id=${id}`);
      if (!resultResponse.ok) {
        throw new Error(`Result fetch failed: ${resultResponse.status}`);
      }
      
      const { output } = await resultResponse.json();
      
      // Format and display output
      const outputLines = output.split('\n').map(line => ({ 
        type: status === 'failed' ? 'warning' : 'output', 
        content: line 
      }));
      
      setTerminalOutput(prev => [
        ...prev,
        { 
          type: status === 'failed' ? 'warning' : 'output', 
          content: status === 'failed' 
            ? '------- EXECUTION FAILED -------' 
            : '------- EXECUTION RESULT -------'
        },
        ...outputLines
      ]);
      
      if (status === 'failed') {
        console.error('Code execution failed:', output);
      }
      
    } catch (error) {
      setTerminalOutput(prev => [...prev, { type: 'warning', content: `Error: ${error.message}` }]);
    } finally {
      // Set running state to false
      setIsRunning(false);
    }
  };
  
  // Helper function to convert file extension to language identifier for API
  const getLanguageFromExtension = (extension) => {
    const languageMap = {
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'py': 'python',
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript'
    };
    
    return languageMap[extension] || extension;
  };

  // Update this function to also update parent state
  const togglePanel = () => {
    const newState = !showPanel;
    setShowPanel(newState);
    if (setPanelVisible) {
      setPanelVisible(newState);
    }
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
                  <span>Run</span>
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
              onClose={togglePanel} // Use the new function
            />
          </>
        )}

        <div className="editor-actions">
          <button 
            className="editor-action-button"
            onClick={handleSaveFile}
            disabled={!activeTab || !unsavedChanges[activeTab]}
            title="Save file"
          >
            <Save size={16} />
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

