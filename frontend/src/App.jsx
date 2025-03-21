import { useState, useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { Tree } from 'react-arborist'
import './App.css'

// Helper function to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

function Node({ node, style, dragHandle, tree }) {
  // Access context correctly
  const context = tree.props.context || {};
  const { addNewFile, addNewFolder, deleteNode } = context;
  
  const handleNodeClick = (e) => {
    e.stopPropagation();
    node.select();
    if (!node.isLeaf) node.toggle();
  };
  
  const handleContextMenu = (e) => {
    e.preventDefault();
    node.select();
  };
  
  // Context menu for file operations with icons
  const renderContextMenu = () => {
    if (!node.isSelected) return null;
    
    return (
      <div className="context-menu">
        {!node.isLeaf && (
          <>
            <button 
              onClick={() => addNewFile && addNewFile(node.id)} 
              title="New File"
            >
              <span className="menu-icon">📄</span> New File
            </button>
            <button 
              onClick={() => addNewFolder && addNewFolder(node.id)} 
              title="New Folder"
            >
              <span className="menu-icon">📁</span> New Folder
            </button>
          </>
        )}
        <button 
          className="delete-btn" 
          onClick={() => {
            if (deleteNode && window.confirm(`Delete ${node.data.name}?`)) {
              deleteNode(node.id);
            }
          }} 
          title="Delete"
        >
          <span className="menu-icon">🗑️</span> Delete
        </button>
      </div>
    );
  };

  return (
    <div 
      className={`tree-node ${node.isSelected ? 'selected' : ''}`} 
      style={style} 
      ref={dragHandle}
      onClick={handleNodeClick}
      onContextMenu={handleContextMenu}
    >
      <span className="node-icon">{node.isLeaf ? '📄' : node.isOpen ? '📂' : '📁'}</span>
      <span className="node-text">{node.data.name}</span>
      {node.isSelected && renderContextMenu()}
    </div>
  );
}

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [fileLanguage, setFileLanguage] = useState('plaintext');
  const [treeHeight, setTreeHeight] = useState(500);
  const [fileSystem, setFileSystem] = useState({});
  const [treeData, setTreeData] = useState([]);
  const sidebarRef = useRef(null);
  const editorRef = useRef(null);
  
  // Get language from file extension
  const getLanguage = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
      'py': 'python',
      'java': 'java',
    };
    return languageMap[extension] || 'plaintext';
  };
  
  // Update tree height when component mounts and on window resize
  useEffect(() => {
    const updateHeight = () => {
      if (sidebarRef.current) {
        const headerHeight = 40;
        setTreeHeight(sidebarRef.current.clientHeight - headerHeight);
      }
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Handle editor mount
  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
  };
  
  // Handle file selection
  const handleNodeSelect = (nodes) => {
    if (nodes.length === 0) {
      setSelectedFile(null);
      setFileContent('');
      setFileLanguage('plaintext');
      return;
    }
    
    const node = nodes[0];
    if (node.isLeaf) {
      const fileId = node.id;
      const file = fileSystem[fileId];
      
      if (file) {
        setSelectedFile(fileId);
        setFileContent(file.content);
        setFileLanguage(file.language);
      }
    }
  };

  // Save content when changed
  const handleEditorChange = (value) => {
    if (selectedFile) {
      setFileContent(value);
      setFileSystem(prev => ({
        ...prev,
        [selectedFile]: {
          ...prev[selectedFile],
          content: value
        }
      }));
    }
  };

  // Find a node by ID (recursively)
  const findNodeById = (nodes, id) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Add a new file to a folder
  const handleAddNewFile = (folderId) => {
    console.log("Adding new file to folder:", folderId);
    const fileName = prompt('Enter file name:');
    if (!fileName) return;
    
    const fileId = `file-${generateId()}`;
    const language = getLanguage(fileName);
    
    // Add to file system
    setFileSystem(prev => ({
      ...prev,
      [fileId]: {
        name: fileName,
        content: '',
        language
      }
    }));
    
    // Add to tree data
    setTreeData(prev => {
      const newData = [...prev];
      
      // If folderId is 'root', add to root level
      if (folderId === 'root') {
        newData.push({ id: fileId, name: fileName });
        return newData;
      }
      
      // Otherwise find the parent folder and add as child
      const folder = findNodeById(newData, folderId);
      if (folder) {
        if (!folder.children) folder.children = [];
        folder.children.push({ id: fileId, name: fileName });
      }
      
      return newData;
    });
  };

  // Add a new folder
  const handleAddNewFolder = (parentId) => {
    console.log("Adding new folder to parent:", parentId);
    const folderName = prompt('Enter folder name:');
    if (!folderName) return;
    
    const folderId = `folder-${generateId()}`;
    
    // Add to tree data
    setTreeData(prev => {
      const newData = [...prev];
      
      // If parentId is 'root', add to root level
      if (parentId === 'root') {
        newData.push({ id: folderId, name: folderName, children: [] });
        return newData;
      }
      
      // Otherwise find the parent folder and add as child
      const parent = findNodeById(newData, parentId);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push({ id: folderId, name: folderName, children: [] });
      }
      
      return newData;
    });
  };
  
  // Delete a node (file or folder)
  const handleDeleteNode = (nodeId) => {
    console.log("Deleting node:", nodeId);
    // Delete from tree data
    setTreeData(prev => {
      const removeNode = (nodes, id) => {
        return nodes.filter(node => {
          if (node.id === id) return false;
          if (node.children) {
            node.children = removeNode(node.children, id);
          }
          return true;
        });
      };
      
      return removeNode([...prev], nodeId);
    });
    
    // Delete from fileSystem if it's a file
    if (fileSystem[nodeId]) {
      setFileSystem(prev => {
        const newSystem = { ...prev };
        delete newSystem[nodeId];
        return newSystem;
      });
      
      // Clear editor if the deleted file was selected
      if (selectedFile === nodeId) {
        setSelectedFile(null);
        setFileContent('');
        setFileLanguage('plaintext');
      }
    }
  };

  // Welcome message when no file is selected
  const welcomeMessage = `# Welcome to Monaco Editor

## Getting Started

1. Create files and folders using the sidebar buttons
2. Click on a file to edit its contents
3. Right-click on files or folders for more options

Happy coding!`;

  return (
    <div className="vscode-container">
      <div className="sidebar" ref={sidebarRef}>
        <div className="explorer-header">
          EXPLORER
          <div className="explorer-actions">
            <button 
              onClick={() => handleAddNewFile('root')} 
              title="New File" 
              className="action-button"
            >📄</button>
            <button 
              onClick={() => handleAddNewFolder('root')} 
              title="New Folder" 
              className="action-button"
            >📁</button>
          </div>
        </div>
        <Tree
          data={treeData}
          width={250}
          height={treeHeight}
          indent={24}
          rowHeight={24}
          onSelect={handleNodeSelect}
          selection="single"
          openByDefault={false}
          context={{
            addNewFile: handleAddNewFile,
            addNewFolder: handleAddNewFolder,
            deleteNode: handleDeleteNode
          }}
        >
          {Node}
        </Tree>
      </div>
      <div className="editor-container">
        <div className="editor-header">
          {selectedFile ? fileSystem[selectedFile]?.name : 'Welcome'}
        </div>
        <Editor
          height="100%"
          language={selectedFile ? fileLanguage : 'markdown'}
          value={selectedFile ? fileContent : welcomeMessage}
          onChange={handleEditorChange}
          theme="vs-dark"
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            readOnly: !selectedFile
          }}
        />
      </div>
    </div>
  )
}

export default App