import React from "react";
import { useState, useEffect } from "react";

const Sidebar = ({ 
  activeView, 
  width, 
  fileStructure, 
  expandedFolders, 
  setExpandedFolders,
  handleContextMenu,
  openFile,
  unsavedChanges,
  activeTab,
  isRenaming,
  renamePath,
  renameValue,
  handleRename,
  renameInputRef,
  cancelRename,
  setIsNewFileModalOpen,  // Add this prop
  createNewFolder 
}) => {
  
  const toggleFolder = (folderPath) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  const renderExplorer = () => {
    const renderFileTree = (structure, path = "") => {
      if (!structure) return null;
  
      return Object.entries(structure).map(([name, item]) => {
        const currentPath = path ? `${path}/${name}` : name;
  
        if (item.type === "folder") {
          const isExpanded = expandedFolders[currentPath];
          return (
            <div key={currentPath} className="file-tree-item">
              <div 
                className="file-tree-folder" 
                onClick={() => toggleFolder(currentPath)}
                onContextMenu={(e) => handleContextMenu(e, currentPath, 'folder')}
              >
                <span className="folder-icon">
                  {isExpanded ? (
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
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  ) : (
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
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  )}
                </span>
                <span className="folder-name">{name}</span>
              </div>
              {isExpanded && (
                <div className="file-tree-children">
                  {renderFileTree(item.children, currentPath)}
                </div>
              )}
            </div>
          );
        } else {
          // It's a file
          const isActive = activeTab === currentPath;
          return (
            <div key={currentPath} className="file-tree-item">
              <div 
                className={`file-tree-file ${isActive ? 'active' : ''}`}
                onClick={() => openFile(currentPath)}
                onContextMenu={(e) => handleContextMenu(e, currentPath, 'file')}
              >
                <span className="file-icon">
                  {getFileIcon(name)}
                </span>
                <span className="file-name">
                  {isRenaming && renamePath === currentPath ? (
                    <form onSubmit={handleRename}>
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={cancelRename}
                        className="rename-input"
                      />
                    </form>
                  ) : (
                    <>
                      {name}
                      {unsavedChanges[currentPath] && <span className="unsaved-indicator"> •</span>}
                    </>
                  )}
                </span>
              </div>
            </div>
          );
        }
      });
    };
  
    return (
      <div className="sidebar-section">
        <div className="sidebar-title">
          <span>EXPLORER</span>
          <div className="sidebar-actions">
            <button className="sidebar-action" onClick={() => createNewFolder()}>
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
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                <line x1="12" y1="11" x2="12" y2="17"></line>
                <line x1="9" y1="14" x2="15" y2="14"></line>
              </svg>
            </button>
            <button className="sidebar-action" onClick={() => setIsNewFileModalOpen(true)}>
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
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="12" x2="12" y2="18"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
            </button>
          </div>
        </div>
        <div className="file-tree">{renderFileTree(fileStructure)}</div>
      </div>
    );
  };
  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    
    if (['jsx', 'js', 'ts', 'tsx'].includes(extension)) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#e6db74"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
      );
    } else if (['css', 'scss', 'less'].includes(extension)) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#66d9ef"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
      );
    } else if (['md', 'markdown'].includes(extension)) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
      );
    }
    
    return (
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
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
    );
  };

  const renderSearch = () => {
    return (
      <div className="sidebar-section">
        <div className="sidebar-title">SEARCH</div>
        <div className="sidebar-search">
          <div className="search-input-container">
            <input type="text" placeholder="Search" className="search-input" />
            <span className="search-icon">
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
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderGit = () => {
    return (
      <div className="sidebar-section">
        <div className="sidebar-title">SOURCE CONTROL</div>
        <div className="sidebar-empty-message">No changes detected</div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeView) {
      case "explorer":
        return renderExplorer();
      case "search":
        return renderSearch();
      case "git":
        return renderGit();
      default:
        return <div className="sidebar-empty-message">Content for {activeView}</div>;
    }
  };

  return (
    <div className="sidebar" style={{ width: `${width}px` }}>
      {renderContent()}
    </div>
  );
};

export default Sidebar;

