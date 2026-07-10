import React from 'react';

export type TabType = 'overview' | 'diff' | 'comments' | 'approve' | 'reject' | 'complete' | 'init';

interface TerminalMockupProps {
  activeTab: TabType;
}

export const TerminalMockup: React.FC<TerminalMockupProps> = ({ activeTab }) => {
  // The 'init' view is a completely different full-screen UI
  if (activeTab === 'init') {
    return (
      <div className="terminal-body" style={{ padding: '2rem', minHeight: '600px', backgroundColor: '#1e0a23', color: '#a09ca1', fontSize: '0.85rem', fontFamily: '"Fira Code", monospace', lineHeight: '1.4', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ marginTop: '2rem', border: '1px solid #00ced1', padding: '2rem 4rem', width: '80%', maxWidth: '800px', textAlign: 'center', position: 'relative' }}>
          
          <h1 style={{ color: '#00ced1', fontSize: '3rem', margin: '0 0 2rem 0', textShadow: '0 0 10px rgba(0,206,209,0.5)', letterSpacing: '4px' }}>ADOTUI</h1>
          
          <div style={{ color: '#00ced1', fontWeight: 'bold', marginBottom: '1.5rem' }}>
            ▪ ADOTUI INITIAL SETUP
          </div>
          
          <div style={{ color: '#808080', marginBottom: '2rem' }}>
            Configure Azure DevOps projects to monitor.
          </div>

          <div style={{ border: '1px solid #451b43', padding: '1rem', textAlign: 'left', margin: '0 auto 2rem auto', width: '80%' }}>
            <div style={{ color: '#00ced1', marginBottom: '0.5rem' }}>Configured Projects (1)</div>
            <div><span style={{ color: '#fff' }}>▶ Acme Corp</span> <span style={{ color: '#808080' }}>(https://dev.azure.com/acme-corp)</span></div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', color: '#808080' }}>
            <div style={{ cursor: 'pointer' }}>+ Add New Project</div>
            <div style={{ cursor: 'pointer' }}>🔑 Configure PAT Token</div>
            <div style={{ cursor: 'pointer' }}>❓ Keyboard & CLI Help</div>
            <div style={{ cursor: 'pointer' }}>✓ Save & Load Configuration</div>
            <div style={{ cursor: 'pointer' }}>✗ Exit ADOTUI</div>
          </div>

          <div style={{ marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid #451b43', color: '#808080', fontSize: '0.75rem' }}>
            Press Tab/Arrows to navigate · Delete/Backspace to remove project<br/>
            Enter to edit project · Ctrl-C to quit
          </div>
        </div>
      </div>
    );
  }

  // Determine the base tab for overlays
  const baseTab = (activeTab === 'approve' || activeTab === 'reject' || activeTab === 'complete') ? 'overview' : activeTab;

  return (
    <div className="terminal-body" style={{ padding: '1rem', minHeight: '600px', overflowX: 'auto', backgroundColor: '#1e0a23', color: '#a09ca1', fontSize: '0.85rem', fontFamily: '"Fira Code", monospace', lineHeight: '1.4', position: 'relative' }}>
      <div style={{ minWidth: '800px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Top Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <span style={{ color: '#00ced1' }}>▪ ADOTUI</span>
          <span style={{ color: '#808080' }}>Azure DevOps PR Monitor · linux</span>
        </div>
        
        <div style={{ marginBottom: '1rem' }}>Focus: {baseTab === 'overview' ? 'Overview' : baseTab === 'diff' ? 'Diff' : 'Comments'}</div>
        
        {/* Stats Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div>
            <span style={{ color: '#d02090' }}>active</span> <span style={{ color: '#fff' }}>3</span>{'  '}
            <span style={{ color: '#d02090' }}>total</span> <span style={{ color: '#fff' }}>3</span>{'  '}
            <span style={{ color: '#d02090' }}>orgs</span> <span style={{ color: '#fff' }}>1</span>{'  '}
            <span style={{ color: '#d02090' }}>repos</span> <span style={{ color: '#fff' }}>3</span>
          </div>
          <div>
            <span style={{ color: '#32cd32' }}>✓ ready</span>{'  '}
            <span style={{ color: '#32cd32' }}>↺ auto on</span>{'  '}
            <span style={{ color: '#808080' }}>synced just now</span>
          </div>
        </div>

        {/* Main Panes */}
        <div style={{ display: 'flex', gap: '0', flexGrow: 1 }}>
          {/* Left Pane */}
          <div style={{ width: '25%', border: '1px solid #00ced1', borderRight: 'none', padding: '0.25rem 0' }}>
            <div style={{ padding: '0 0.5rem', color: '#808080' }}>◇ Organizations{'    '}<span style={{ color: '#ff8c00' }}>PRs only</span></div>
            <div style={{ padding: '0 0.5rem', marginTop: '0.5rem' }}>
              <div><span style={{ color: '#fff' }}>▶ acme-corp</span></div>
              <div style={{ paddingLeft: '1rem', color: '#808080' }}>3/3 repos · 3 prs</div>
              <div style={{ paddingLeft: '1rem' }}><span style={{ color: '#00ced1' }}>┌</span> <span style={{ color: '#ff8c00' }}>backend-services</span></div>
              <div style={{ paddingLeft: '1rem' }}><span style={{ color: '#00ced1' }}>└</span> <span style={{ color: '#808080' }}>└ api-gateway </span><span style={{ color: '#32cd32' }}>(1)</span></div>
              <div style={{ paddingLeft: '1rem' }}><span style={{ color: '#ff8c00' }}>┌ frontend-apps</span></div>
              <div style={{ paddingLeft: '1rem' }}><span style={{ color: '#00ced1' }}>├</span> <span style={{ color: '#808080' }}>└ web-client </span><span style={{ color: '#32cd32' }}>(1)</span></div>
              <div style={{ paddingLeft: '1rem' }}><span style={{ color: '#00ced1' }}>└</span> <span style={{ color: '#808080' }}>└ mobile-app </span><span style={{ color: '#32cd32' }}>(1)</span></div>
            </div>
          </div>

          {/* Right Pane */}
          <div style={{ width: '75%', border: '1px solid #00ced1', padding: '0.25rem 0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0 0.5rem', display: 'flex', justifyContent: 'space-between' }}>
              <span><span style={{ color: '#00ced1' }}>▪</span> Pull Requests → backend-services</span>
              <span style={{ color: '#808080' }}>1 total</span>
            </div>
            <div style={{ padding: '0 0.5rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
              <span><span style={{ color: '#00ced1' }}>▶</span> <span style={{ color: '#808080' }}>#42</span>{'   '}<span style={{ color: '#fff', fontWeight: 'bold' }}>Implement OAuth2 Authentication</span></span>
              <span><span style={{ color: '#808080' }}>Alice S.</span>{'    '}<span style={{ color: '#ff8c00' }}>missing required</span>{' '}<span style={{ color: '#32cd32' }}>active</span></span>
            </div>

            <div style={{ padding: '0 0.5rem', marginTop: '1.5rem', color: '#808080', display: 'flex', gap: '1rem' }}>
              <span style={{ backgroundColor: baseTab === 'overview' ? '#00ced1' : 'transparent', color: baseTab === 'overview' ? '#000' : 'inherit', padding: '0 4px', fontWeight: baseTab === 'overview' ? 'bold' : 'normal' }}>1 overview</span>
              <span style={{ backgroundColor: baseTab === 'diff' ? '#00ced1' : 'transparent', color: baseTab === 'diff' ? '#000' : 'inherit', padding: '0 4px', fontWeight: baseTab === 'diff' ? 'bold' : 'normal' }}>2 diff</span>
              <span style={{ backgroundColor: baseTab === 'comments' ? '#00ced1' : 'transparent', color: baseTab === 'comments' ? '#000' : 'inherit', padding: '0 4px', fontWeight: baseTab === 'comments' ? 'bold' : 'normal' }}>3 comments</span>
            </div>

            <div style={{ padding: '0 0.5rem', marginTop: '1rem' }}>
              {baseTab === 'overview' && (
                <>
                  <div><span style={{ color: '#00ced1' }}>▪</span> <span style={{ color: '#00ced1', fontWeight: 'bold' }}>Details</span></div>
                  <div style={{ marginTop: '1rem', color: '#fff', fontWeight: 'bold' }}>#42 Implement OAuth2 Authentication</div>
                  
                  <div style={{ display: 'flex', marginTop: '1.5rem', gap: '4rem' }}>
                    <div>
                      <div><span style={{ color: '#808080', display: 'inline-block', width: '80px' }}>author</span> <span style={{ color: '#c0c0c0' }}>Alice Smith</span></div>
                      <div><span style={{ color: '#808080', display: 'inline-block', width: '80px' }}>updated</span> <span style={{ color: '#c0c0c0' }}>2h ago</span></div>
                      <div><span style={{ color: '#808080', display: 'inline-block', width: '80px' }}>branch</span> <span style={{ color: '#4169e1' }}>feat/oauth2</span> → <span style={{ color: '#c0c0c0' }}>main</span></div>
                      <div><span style={{ color: '#808080', display: 'inline-block', width: '80px' }}>review</span> <span style={{ color: '#ff8c00' }}>⚠️ missing required</span></div>
                    </div>
                    <div>
                      <div><span style={{ color: '#808080', display: 'inline-block', width: '80px' }}>status</span> <span style={{ color: '#32cd32' }}>• active</span></div>
                      <div><span style={{ color: '#808080', display: 'inline-block', width: '80px' }}>merge</span> <span style={{ color: '#32cd32' }}>✓ no conflicts</span></div>
                      <div><span style={{ color: '#808080', display: 'inline-block', width: '80px' }}>checks</span> <span style={{ color: '#32cd32' }}>✓ 4 passed</span></div>
                      <div><span style={{ color: '#808080', display: 'inline-block', width: '80px' }}>comments</span> <span style={{ color: '#c0c0c0' }}>6 <span style={{ color: '#ff8c00' }}>(2 active)</span></span></div>
                      <div><span style={{ color: '#808080', display: 'inline-block', width: '80px' }}>files</span> <span style={{ color: '#c0c0c0' }}>4 (press l / files tab)</span></div>
                    </div>
                  </div>

                  <div style={{ marginTop: '2rem' }}>
                    <span style={{ color: '#808080', display: 'inline-block', width: '80px' }}>tags</span> <span style={{ color: '#4169e1' }}>#security</span> <span style={{ color: '#4169e1' }}>#backend</span>
                  </div>
                  
                  <div style={{ marginTop: '1rem' }}>
                    <span style={{ color: '#808080', display: 'inline-block', width: '80px' }}>work items</span> <span style={{ color: '#fff' }}>#1024 In Progress</span> · Add OAuth2 Support
                  </div>

                  <div style={{ marginTop: '1.5rem', color: '#808080' }}>
                    https://dev.azure.com/acme-corp/backend-services/_git/api-gateway/pullrequest/42
                  </div>
                </>
              )}

              {baseTab === 'diff' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div><span style={{ color: '#00ced1' }}>◇</span> <span style={{ color: '#00ced1', fontWeight: 'bold' }}>Files</span></div>
                    <div style={{ color: '#808080' }}>1/4 · unified</div>
                  </div>
                  <div style={{ marginTop: '1rem', color: '#808080' }}>
                    <div><span style={{ color: '#f85149' }}>- README.md</span> <span style={{ color: '#f85149' }}>+0 -12</span></div>
                    <div><span style={{ color: '#00ced1' }}>▶</span> <span style={{ color: '#3fb950' }}>+ src/auth/oauth2.ts</span> <span style={{ color: '#3fb950' }}>+145 -0</span></div>
                    <div><span style={{ color: '#3fb950' }}>+ src/auth/token.ts</span></div>
                    <div><span style={{ color: '#3fb950' }}>+ tests/auth.test.ts</span></div>
                  </div>
                  <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ color: '#4169e1' }}>src/auth/oauth2.ts +145 -0</div>
                    <div style={{ color: '#00ced1' }}>▶ @@ -0,0 +1,145 @@</div>
                    <div style={{ color: '#808080' }}>{'   '}1 + <span style={{ color: '#c0c0c0' }}>/**</span></div>
                    <div style={{ color: '#808080' }}>{'   '}2 + <span style={{ color: '#c0c0c0' }}> * Implements OAuth2 authorization code flow</span></div>
                    <div style={{ color: '#808080' }}>{'   '}3 + <span style={{ color: '#c0c0c0' }}> */</span></div>
                    <div style={{ color: '#808080' }}>{'   '}4 + <span style={{ color: '#d02090' }}>export function</span> <span style={{ color: '#fff' }}>handleOAuthCallback</span>(code: <span style={{ color: '#00ced1' }}>string</span>) {'{'}</div>
                    <div style={{ color: '#808080' }}>{'   '}5 +   <span style={{ color: '#d02090' }}>const</span> token = <span style={{ color: '#fff' }}>exchangeCodeForToken</span>(code);</div>
                    <div style={{ color: '#808080' }}>{'   '}6 +   <span style={{ color: '#d02090' }}>return</span> token;</div>
                    <div style={{ color: '#808080' }}>{'   '}7 + {'}'}</div>
                  </div>
                </>
              )}

              {baseTab === 'comments' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div><span style={{ color: '#00ced1' }}>▪</span> <span style={{ color: '#00ced1', fontWeight: 'bold' }}>Comments</span></div>
                    <div style={{ color: '#808080' }}>1/6 threads (12 comments)</div>
                  </div>
                  
                  <div style={{ marginTop: '1rem', border: '1px solid #00ced1', padding: '0.5rem' }}>
                    <div><span style={{ color: '#00ced1' }}>▶</span> <span style={{ color: '#32cd32' }}>[resolved]</span> <span style={{ color: '#4169e1' }}>src/auth/oauth2.ts</span> <span style={{ color: '#808080' }}>4 comments</span></div>
                    <div style={{ marginTop: '0.5rem', display: 'flex' }}>
                      <span style={{ backgroundColor: '#fff', color: '#000', padding: '0 4px', marginRight: '0.5rem' }}>&gt; Alice S.</span>
                      <span style={{ color: '#808080' }}>2h ago</span>
                    </div>
                    <div style={{ color: '#fff', marginTop: '0.25rem' }}>Make sure we handle token refresh here.</div>
                    
                    <div style={{ marginTop: '1rem', borderTop: '1px solid #30363d', paddingTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#808080' }}>
                        <span>Replies</span>
                        <span>4/4</span>
                      </div>
                      <div style={{ marginTop: '0.5rem' }}>
                        <div><span style={{ color: '#4169e1' }}>↳ Bob M.</span> <span style={{ color: '#808080' }}>1h ago</span></div>
                        <div style={{ color: '#c0c0c0' }}>Good catch, I will add the refresh logic in the next commit.</div>
                      </div>
                      <div style={{ marginTop: '1rem' }}>
                        <div><span style={{ color: '#4169e1' }}>↳ Alice S.</span> <span style={{ color: '#808080' }}>30m ago</span></div>
                        <div style={{ color: '#c0c0c0' }}>Looks great now, resolving this thread.</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', padding: '0.5rem' }}>
                    <div><span style={{ color: '#32cd32' }}>[resolved]</span> <span style={{ color: '#4169e1' }}>src/auth/token.ts</span> <span style={{ color: '#808080' }}>2 comments</span></div>
                    <div style={{ color: '#808080' }}>Alice S. <span style={{ color: '#4169e1' }}>↳ 1 reply</span></div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar - Only shown if not obscured by a prompt overlay */}
        {activeTab !== 'approve' && activeTab !== 'reject' && activeTab !== 'complete' && (
          <div>
            <div style={{ marginTop: '1rem', color: '#808080' }}>
              * Press / to filter or run commands
            </div>
            <div style={{ borderTop: '1px solid #451b43', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', gap: '1rem', color: '#808080', flexWrap: 'wrap' }}>
              <span><span style={{ color: '#00ced1', fontWeight: 'bold' }}>/</span> filter</span>
              <span><span style={{ color: '#00ced1', fontWeight: 'bold' }}>j/k</span> navigate</span>
              {baseTab === 'diff' && <span><span style={{ color: '#00ced1', fontWeight: 'bold' }}>[/]</span> switch files</span>}
              {baseTab === 'comments' && <span><span style={{ color: '#00ced1', fontWeight: 'bold' }}>r</span> reply</span>}
              <span><span style={{ color: '#00ced1', fontWeight: 'bold' }}>1-3</span> switch view tab</span>
              <span><span style={{ color: '#00ced1', fontWeight: 'bold' }}>tab</span> focus</span>
              <span><span style={{ color: '#00ced1', fontWeight: 'bold' }}>a</span> approve</span>
              <span><span style={{ color: '#00ced1', fontWeight: 'bold' }}>?</span> help</span>
              <span><span style={{ color: '#00ced1', fontWeight: 'bold' }}>q</span> quit</span>
            </div>
          </div>
        )}

        {/* Overlays */}
        {activeTab === 'approve' && (
          <div style={{ border: '1px solid #00ced1', backgroundColor: '#1e0a23', position: 'absolute', bottom: '1rem', left: '1rem', right: '1rem', padding: '1rem', zIndex: 10 }}>
            <div style={{ color: '#00ced1', marginBottom: '1rem' }}>▪ Approve Pull Request</div>
            <div style={{ color: '#fff', marginBottom: '1rem' }}>Are you sure you want to approve this pull request?</div>
            <div style={{ color: '#808080' }}>
              <span style={{ color: '#fff' }}>[ Y ]</span> Yes{'    '}<span style={{ color: '#fff' }}>[ N ]</span> Cancel
            </div>
          </div>
        )}

        {activeTab === 'reject' && (
          <div style={{ border: '1px solid #00ced1', backgroundColor: '#1e0a23', position: 'absolute', bottom: '1rem', left: '1rem', right: '1rem', padding: '1rem', zIndex: 10 }}>
            <div style={{ color: '#00ced1', marginBottom: '1rem' }}>▪ Abandon Pull Request</div>
            <div style={{ color: '#fff', marginBottom: '1rem' }}>Are you sure you want to abandon (reject) this pull request?</div>
            <div style={{ color: '#808080' }}>
              <span style={{ color: '#fff' }}>[ Y ]</span> Yes{'    '}<span style={{ color: '#fff' }}>[ N ]</span> Cancel
            </div>
          </div>
        )}

        {activeTab === 'complete' && (
          <div style={{ border: '1px solid #00ced1', backgroundColor: '#1e0a23', position: 'absolute', bottom: '1rem', left: '1rem', right: '1rem', padding: '1rem', zIndex: 10 }}>
            <div style={{ color: '#00ced1', marginBottom: '0.5rem' }}>▪ Completion Editor</div>
            <div style={{ color: '#808080', fontSize: '0.75rem', marginBottom: '1rem' }}>strategy=noFastForward | delete-branch=yes | transition-work-items=yes | bypass-policy=no</div>
            
            <div style={{ display: 'flex', gap: '2rem' }}>
              <div style={{ color: '#fff' }}>
                <div>▶ Merge strategy</div>
                <div>{'  '}delete source branch</div>
                <div>{'  '}transition work items</div>
                <div>{'  '}bypass policy</div>
                <div>{'  '}bypass reason</div>
                <div>{'  '}merge commit message</div>
                <div>{'  '}auto-complete ignore</div>
                <div>{'  '}squash merge</div>
                <div style={{ marginTop: '0.5rem', color: '#808080' }}>{'  '}complete PR</div>
              </div>
              <div style={{ color: '#808080' }}>
                <div style={{ color: '#4169e1' }}>noFastForward</div>
                <div style={{ color: '#fff' }}>yes</div>
                <div style={{ color: '#fff' }}>yes</div>
                <div style={{ color: '#fff' }}>no</div>
                <div>&lt;type text&gt;</div>
                <div>&lt;type text&gt;</div>
                <div>&lt;type ids&gt;</div>
                <div style={{ color: '#fff' }}>no</div>
                <div style={{ marginTop: '0.5rem' }}>✓ press enter to complete</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #451b43', marginTop: '1rem', paddingTop: '0.5rem', color: '#808080', fontSize: '0.75rem' }}>
              ↑/↓ or tab move · space toggle · type on text rows · enter confirm · esc cancel
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
