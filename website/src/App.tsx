import { useState, useEffect } from 'react';
import { TerminalMockup } from './TerminalMockup';
import type { TabType } from './TerminalMockup';

const TABS: TabType[] = ['init', 'overview', 'diff', 'comments', 'approve', 'reject', 'complete'];

function App() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % TABS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <header className="header container">
        <div className="header-logo">Adotui</div>
        <div className="header-links">
          <a href="https://github.com/techniumlabs/adotui" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="#installation">Install</a>
          <a href="#features">Features</a>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <h1>Manage PRs from the Terminal</h1>
          <p>
            A blazing fast, keyboard-driven Terminal UI (TUI) for managing Azure DevOps Pull Requests. Built with React and Ink.
          </p>
          <div className="hero-buttons">
            <a href="#installation" className="btn btn-primary">Get Started</a>
            <a href="https://github.com/techniumlabs/adotui" className="btn btn-outline" target="_blank" rel="noopener noreferrer">View Source</a>
          </div>

          <div className="terminal-window">
            <div className="terminal-header">
              <div className="terminal-dots">
                <div className="dot red"></div>
                <div className="dot yellow"></div>
                <div className="dot green"></div>
              </div>
              <div className="terminal-title">~/dev/adotui</div>
            </div>

            <TerminalMockup activeTab={TABS[currentSlide]} />

            {/* Slider Controls */}
            <div style={{ backgroundColor: '#1e0a23', paddingBottom: '1rem', display: 'flex', justifyContent: 'center', gap: '8px' }}>
              {TABS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: currentSlide === idx ? '#00ced1' : 'rgba(255, 255, 255, 0.2)',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="features">
          <div className="feature-card">
            <div className="feature-icon">🚀</div>
            <h3 className="feature-title">Multi-Org Support</h3>
            <p className="feature-desc">Seamlessly manage PRs across multiple Azure DevOps organizations and projects from a single unified configuration.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h3 className="feature-title">Threaded Comments</h3>
            <p className="feature-desc">View, add, edit, and delete PR comments natively. Full support for nested threaded reply chains with smart scrolling.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">👀</div>
            <h3 className="feature-title">Built-in Diff Viewer</h3>
            <p className="feature-desc">Review file diffs instantly without leaving your terminal. Features lazy-loading for large repositories and intelligent layout.</p>
          </div>
        </section>

        <section id="installation" className="keybindings">
          <h2 className="section-title">Installation</h2>
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Run this command to install the latest binary globally on Linux/macOS:</p>
            <div className="terminal-window" style={{ margin: '0 auto', maxWidth: '700px' }}>
              <div className="terminal-body" style={{ padding: '1rem 1.5rem' }}>
                <span className="prompt">$</span>
                <span className="command">curl -fsSL https://raw.githubusercontent.com/techniumlabs/adotui/main/install.sh | bash</span>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Or for Windows (PowerShell):</p>
            <div className="terminal-window" style={{ margin: '0 auto', maxWidth: '700px' }}>
              <div className="terminal-body" style={{ padding: '1rem 1.5rem' }}>
                <span className="prompt">&gt;</span>
                <span className="command">iwr -useb https://raw.githubusercontent.com/techniumlabs/adotui/main/install.ps1 | iex</span>
              </div>
            </div>
          </div>
        </section>

        <section id="keybindings" className="keybindings">
          <h2 className="section-title">Vim-like Keybindings</h2>
          <table className="key-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Action</th>
                <th>Context</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="kbd">Tab</span></td>
                <td>Cycle focus between panes</td>
                <td>Global Navigation</td>
              </tr>
              <tr>
                <td><span className="kbd">1</span>-<span className="kbd">4</span></td>
                <td>Switch to Details, Diff, Comments, Runs</td>
                <td>Global Navigation</td>
              </tr>
              <tr>
                <td><span className="kbd">a</span> / <span className="kbd">x</span></td>
                <td>Approve / Reject PR</td>
                <td>Global PR Action</td>
              </tr>
              <tr>
                <td><span className="kbd">c</span> / <span className="kbd">b</span></td>
                <td>Complete / Abandon PR</td>
                <td>Global PR Action</td>
              </tr>
              <tr>
                <td><span className="kbd">/</span></td>
                <td>Enter command mode (filter, find)</td>
                <td>Global Navigation</td>
              </tr>
              <tr>
                <td><span className="kbd">j</span> / <span className="kbd">k</span></td>
                <td>Move selection up / down</td>
                <td>Lists, Trees, Comments</td>
              </tr>
              <tr>
                <td><span className="kbd">[</span> / <span className="kbd">]</span></td>
                <td>Prev / Next file</td>
                <td>Files View</td>
              </tr>
              <tr>
                <td><span className="kbd">n</span> / <span className="kbd">r</span></td>
                <td>Add new thread / Reply</td>
                <td>Comments View</td>
              </tr>
              <tr>
                <td><span className="kbd">?</span> / <span className="kbd">Esc</span> / <span className="kbd">q</span></td>
                <td>Toggle Help / Go back / Quit</td>
                <td>Global Navigation</td>
              </tr>
            </tbody>
          </table>
        </section>
      </main>

      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} Technium Labs & Adotui. Open source under the MIT License.</p>
      </footer>
    </>
  )
}

export default App
