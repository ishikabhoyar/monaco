import React from 'react';
"use client"

import { useState, useEffect } from "react"
import ActivityBar from "./ActivityBar"
import EditorArea from "./EditorArea"
import StatusBar from "./StatusBar"

const VSCodeUI = () => {
  const [activeView, setActiveView] = useState("explorer")
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [panelVisible, setPanelVisible] = useState(true)
  const [panelHeight, setPanelHeight] = useState(200)

  // Effect to handle resize when sidebar visibility changes
  useEffect(() => {
    // Force layout recalculation
    window.dispatchEvent(new Event('resize'));
  }, [sidebarVisible]);

  const toggleSidebar = (view) => {
    if (activeView === view && sidebarVisible) {
      setSidebarVisible(false)
    } else {
      setActiveView(view)
      setSidebarVisible(true)
    }
  }

  const togglePanel = () => {
    setPanelVisible(!panelVisible)
  }

  return (
    <div className="vscode-container">
      <ActivityBar activeTab={activeView} toggleSidebar={toggleSidebar} />
      <div className="vscode-main">
        <div className="editor-container">
          <EditorArea 
            sidebarVisible={sidebarVisible} 
            activeView={activeView}
            panelVisible={panelVisible}
            setPanelVisible={setPanelVisible}
          />
          
          {/* Remove the duplicate Panel component from here */}
        </div>
      </div>
      <StatusBar togglePanel={togglePanel} panelVisible={panelVisible} />
    </div>
  )
}

export default VSCodeUI