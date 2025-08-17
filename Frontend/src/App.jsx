import CodeChallenge from "./components/CodeChallenge.jsx"
import "./index.css"

function App() {
  return (
    <div className="App">
      <CodeChallenge />
      <footer className="footer-bar fixed bottom-0 left-0 right-0 border-t border-slate-200/40 dark:border-gray-800/20 bg-black">
        <div className="flex items-center justify-center h-7">
          <span className="text-xs text-slate-400 dark:text-gray-400 flex items-center">
            Copyright © 2025. Made with <span className="text-red-400 dark:text-red-500 mx-0.5">♡</span> by Ishika and Arnab.
          </span>
        </div>
      </footer>
    </div>
  )
}

export default App

