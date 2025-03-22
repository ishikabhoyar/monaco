import React from "react";
import { Files, Search, GitBranch, Bug, Package, User, Settings } from "lucide-react";

const ActivityBar = ({ activeTab, toggleSidebar }) => {
  const tabs = [
    { id: "explorer", icon: Files, title: "Explorer" },
    { id: "search", icon: Search, title: "Search" },
    { id: "git", icon: GitBranch, title: "Source Control" },
    { id: "debug", icon: Bug, title: "Run and Debug" },
    { id: "extensions", icon: Package, title: "Extensions" },
  ];

  return (
    <div className="activity-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={activeTab === tab.id ? "active" : ""}
          onClick={() => toggleSidebar(tab.id)}
          title={tab.title}
        >
          <tab.icon size={24} />
        </button>
      ))}
      <div style={{ marginTop: "auto" }}>
        <button title="Accounts">
          <User size={24} />
        </button>
        <button title="Settings">
          <Settings size={24} />
        </button>
      </div>
    </div>
  );
};

export default ActivityBar;