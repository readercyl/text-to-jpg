import { useState, useEffect, useRef, useCallback } from 'react'
import html2canvas from 'html2canvas'
import './App.css'

type PageType = 'title' | 'content' | 'ending'

interface Page {
  id: string
  type: PageType
  title: string
  content: string
}

type TemplateId = 'simple' | 'warm' | 'dark'

const TEMPLATES: { id: TemplateId; name: string }[] = [
  { id: 'simple', name: '简约基础' },
  { id: 'warm', name: '清晰明朗' },
  { id: 'dark', name: '黑白极简' },
]

const EMOJIS = ['😀', '😂', '🥰', '😍', '🤔', '👍', '❤️', '🔥', '💯', '✨', '🌟', '💪', '👏', '🎉', '✅', '💡', '🎯', '📝', '💼', '📚', '🏆', '🚀', '💻', '🎨', '🖼️', '📷', '🎬', '🎵']

const ENDING_TEXT = '职场笔记整理好，放在你手边'

function generateId() {
  return Math.random().toString(36).substr(2, 9)
}

function App() {
  const [pages, setPages] = useState<Page[]>([
    { id: generateId(), type: 'title', title: '', content: '' },
    { id: generateId(), type: 'ending', title: '', content: '' },
  ])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [template, setTemplate] = useState<TemplateId>('simple')
  const [activeTab, setActiveTab] = useState<'template' | 'cover'>('template')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [wordCount, setWordCount] = useState(0)
  const [lastSaved, setLastSaved] = useState(new Date())
  const [coverTitle, setCoverTitle] = useState('')
  const [coverSubtitle, setCoverSubtitle] = useState('')

  const contentRefs = useRef<(HTMLDivElement | null)[]>([])
  const endingCardRef = useRef<HTMLDivElement>(null)

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastSaved(new Date())
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Calculate word count
  useEffect(() => {
    const text = pages.reduce((acc, page) => acc + page.title + page.content, '')
    const count = text.replace(/\s/g, '').length
    setWordCount(count)
  }, [pages])

  // Handle content change with auto-pagination
  const handleContentChange = useCallback((value: string, pageIndex: number) => {
    setPages(prev => prev.map((p, i) => i === pageIndex ? { ...p, content: value } : p))
  }, [])

  // Check if content overflows and create new page
  const checkAndSplitContent = useCallback((pageIndex: number) => {
    const contentEl = contentRefs.current[pageIndex]
    if (!contentEl) return

    const scrollHeight = contentEl.scrollHeight
    const clientHeight = contentEl.clientHeight

    // If content overflows, we need to split it
    if (scrollHeight > clientHeight + 10) {
      const text = contentEl.innerText
      const lines = text.split('\n')
      let accumulatedHeight = 0
      let splitIndex = 0

      // Find where to split
      const lineHeight = 27.75 // approx line height (15px * 1.85)
      for (let i = 0; i < lines.length; i++) {
        const lineCount = Math.ceil(lines[i].length / 25) // approx chars per line
        accumulatedHeight += lineCount * lineHeight
        if (accumulatedHeight > clientHeight - 50) {
          splitIndex = i
          break
        }
      }

      if (splitIndex > 0 && splitIndex < lines.length) {
        const currentContent = lines.slice(0, splitIndex).join('\n')
        const nextContent = lines.slice(splitIndex).join('\n')

        // Update current page and create new one
        setPages(prev => {
          const newPages = [...prev]
          const endingPage = newPages.pop()! // Remove ending page temporarily

          newPages[pageIndex] = { ...newPages[pageIndex], content: currentContent }
          newPages.push({ id: generateId(), type: 'content', title: '', content: nextContent })
          newPages.push(endingPage)

          return newPages
        })
      }
    }
  }, [])

  // Handle Enter key for manual page break
  const handleKeyDown = useCallback((e: React.KeyboardEvent, pageIndex: number) => {
    if (e.key === 'Enter') {
      const contentEl = contentRefs.current[pageIndex]
      if (!contentEl) return

      // Check for double Enter
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const text = contentEl.innerText
        const cursorPos = text.length

        // Check if last character before cursor is also Enter
        if (text[cursorPos - 1] === '\n' || (cursorPos === text.length && text.endsWith('\n\n'))) {
          e.preventDefault()

          // Insert page break marker
          document.execCommand('insertHTML', false, '<div class="page-break-hint" contenteditable="false">⬇ 分页</div>')

          // Create new page after a brief delay
          setTimeout(() => {
            setPages(prev => {
              const newPages = [...prev]
              const endingPage = newPages.pop()!

              // Insert new content page after current one
              newPages.push({ id: generateId(), type: 'content', title: '', content: '' })
              newPages.push(endingPage)

              return newPages
            })

            // Focus new page
            setTimeout(() => {
              const newIndex = pageIndex + 1
              setCurrentPageIndex(newIndex)
              contentRefs.current[newIndex]?.focus()
            }, 50)
          }, 50)
        }
      }
    }
  }, [])

  // Insert emoji at cursor
  const insertEmoji = (emoji: string) => {
    const page = pages[currentPageIndex]
    if (page.type === 'title' || page.type === 'content') {
      const contentEl = contentRefs.current[currentPageIndex]
      if (contentEl) {
        document.execCommand('insertText', false, emoji)
      }
    }
    setShowEmojiPicker(false)
  }

  // Export to JPG
  const handleExport = async () => {
    setShowExportModal(false)
    setIsExporting(true)
    setExportProgress(0)

    // Wait for DOM update
    await new Promise(resolve => setTimeout(resolve, 100))

    const pageCards = document.querySelectorAll('.page-card')
    const totalPages = pages.filter(p => p.type !== 'ending').length

    try {
      let exportedCount = 0
      for (let i = 0; i < pageCards.length; i++) {
        const page = pages[i]
        if (page.type === 'ending') continue

        const card = pageCards[i] as HTMLElement
        const canvas = await html2canvas(card, {
          scale: 2,
          backgroundColor: getComputedStyle(card).backgroundColor,
          useCORS: true,
          logging: false,
        })

        const link = document.createElement('a')
        link.download = `笔记_第${exportedCount + 1}页.jpg`
        link.href = canvas.toDataURL('image/jpeg', 0.95)
        link.click()

        exportedCount++
        setExportProgress(Math.round((exportedCount / totalPages) * 100))
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    } catch (error) {
      console.error('Export failed:', error)
    }

    setIsExporting(false)
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  const goToPage = (index: number) => {
    if (index >= 0 && index < pages.length) {
      setCurrentPageIndex(index)
    }
  }

  // Get content pages only for pagination display
  const contentPages = pages.filter(p => p.type !== 'ending')
  const currentContentPageIndex = currentPageIndex === pages.length - 1 ? contentPages.length - 1 : currentPageIndex

  const themeClass = template === 'warm' ? 'warm' : template === 'dark' ? 'dark' : ''

  return (
    <div className="app" data-theme={themeClass}>
      {/* Toolbar */}
      <div className="toolbar">
        <button className="back-btn">
          <span>←</span>
          <span>返回</span>
        </button>
        <div className="toolbar-divider" />
        <button className="toolbar-btn" title="撤销">↩</button>
        <button className="toolbar-btn" title="重做">↪</button>
        <div className="toolbar-divider" />
        <button className="toolbar-btn toolbar-btn-text" title="H1标题"><strong>H1</strong></button>
        <button className="toolbar-btn toolbar-btn-text" title="H2标题"><strong>H2</strong></button>
        <div className="toolbar-divider" />
        <button className="toolbar-btn toolbar-btn-text" title="有序列表">1.</button>
        <button className="toolbar-btn toolbar-btn-text" title="无序列表">•</button>
        <button className="toolbar-btn" title="引用">❝</button>
        <button className="toolbar-btn toolbar-btn-text" title="下划线"><u>U</u></button>
        <div className="toolbar-divider" />
        <button className="toolbar-btn" title="插入图片">🖼</button>
        <button
          className="toolbar-btn"
          title="插入表情"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        >
          😀
        </button>

        {showEmojiPicker && (
          <div className="emoji-picker">
            {EMOJIS.map(emoji => (
              <div
                key={emoji}
                className="emoji-item"
                onClick={() => insertEmoji(emoji)}
              >
                {emoji}
              </div>
            ))}
          </div>
        )}

        <div className="toolbar-spacer" />
      </div>

      {/* Main Layout */}
      <div className="main-layout">
        {/* Editor Area */}
        <div className="editor-area">
          <div className="pages-container">
            {pages.map((page, index) => (
              <div
                key={page.id}
                className={`page-card ${page.type === 'title' ? 'title-page' : page.type === 'ending' ? 'ending-page' : 'content-page'} ${index === currentPageIndex ? 'editing' : ''}`}
                onClick={() => goToPage(index)}
                data-page-index={index}
              >
                {page.type === 'title' && (
                  <>
                    <input
                      className="page-title-input"
                      placeholder="添加标题"
                      value={page.title}
                      onChange={e => {
                        setPages(prev => prev.map((p, i) => i === index ? { ...p, title: e.target.value } : p))
                      }}
                      onClick={e => { e.stopPropagation(); goToPage(index) }}
                    />
                    <div
                      ref={el => { contentRefs.current[index] = el }}
                      className="page-content-editable"
                      contentEditable
                      suppressContentEditableWarning
                      onInput={e => {
                        const target = e.target as HTMLDivElement
                        handleContentChange(target.innerText, index)
                        checkAndSplitContent(index)
                      }}
                      onKeyDown={e => handleKeyDown(e, index)}
                      onClick={e => { e.stopPropagation(); goToPage(index) }}
                    />
                  </>
                )}

                {page.type === 'content' && (
                  <>
                    <input
                      className="page-title-input"
                      placeholder="页面标题"
                      value={page.title}
                      onChange={e => {
                        setPages(prev => prev.map((p, i) => i === index ? { ...p, title: e.target.value } : p))
                      }}
                      onClick={e => { e.stopPropagation(); goToPage(index) }}
                    />
                    <div
                      ref={el => { contentRefs.current[index] = el }}
                      className="page-content-editable"
                      contentEditable
                      suppressContentEditableWarning
                      onInput={e => {
                        const target = e.target as HTMLDivElement
                        handleContentChange(target.innerText, index)
                        checkAndSplitContent(index)
                      }}
                      onKeyDown={e => handleKeyDown(e, index)}
                      onClick={e => { e.stopPropagation(); goToPage(index) }}
                    />
                  </>
                )}

                {page.type === 'ending' && (
                  <div className="ending-card" ref={endingCardRef}>
                    <div className="ending-card-inner">
                      <div className="ending-decoration-top">
                        <div className="ending-line" />
                        <div className="ending-icon-small">✦</div>
                        <div className="ending-line" />
                      </div>
                      <div className="ending-title">E N D</div>
                      <div className="ending-divider" />
                      <div className="ending-text">{ENDING_TEXT}</div>
                      <div className="ending-decoration">
                        <span className="ending-dot" />
                        <span className="ending-dot" />
                        <span className="ending-dot" />
                      </div>
                    </div>
                  </div>
                )}

                {page.type !== 'ending' && (
                  <div className="page-number-indicator">
                    {currentPageIndex === index ? (
                      <span className="current-page-label">当前编辑</span>
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Page Navigation - Circle Indicators */}
          <div className="page-nav-circles">
            {contentPages.map((_, index) => (
              <button
                key={pages[index].id}
                className={`page-circle ${index === currentContentPageIndex ? 'active' : ''}`}
                onClick={() => goToPage(index)}
                title={`第 ${index + 1} 页`}
              >
                {index + 1}
              </button>
            ))}
            <span className="page-nav-total">共 {contentPages.length} 页</span>
          </div>
        </div>

        {/* Side Panel */}
        <div className="side-panel">
          <div className="panel-tabs">
            <button
              className={`panel-tab ${activeTab === 'template' ? 'active' : ''}`}
              onClick={() => setActiveTab('template')}
            >
              选择模板
            </button>
            <button
              className={`panel-tab ${activeTab === 'cover' ? 'active' : ''}`}
              onClick={() => setActiveTab('cover')}
            >
              封面设置
            </button>
          </div>

          <div className="panel-content">
            {activeTab === 'template' && (
              <>
                <div className="template-section">
                  <div className="template-section-title">配色方案</div>
                  <div className="template-grid">
                    {TEMPLATES.map(tpl => (
                      <div key={tpl.id} className="template-item">
                        <div
                          className={`template-thumb ${tpl.id} ${template === tpl.id ? 'selected' : ''}`}
                          onClick={() => setTemplate(tpl.id)}
                        >
                          <div className="template-thumb-content">
                            <div className="template-thumb-line" />
                            <div className="template-thumb-line" />
                            <div className="template-thumb-line" />
                            <div className="template-thumb-line" />
                          </div>
                        </div>
                        <span className="template-label">{tpl.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="template-section">
                  <div className="template-section-title">页面预览</div>
                  <div className="template-preview-info">
                    <span>当前共 {contentPages.length} 页内容</span>
                  </div>
                </div>

                <div className="template-section">
                  <div className="template-section-title">分页提示</div>
                  <div className="template-hint">
                    按 <kbd>Enter</kbd> 两次可插入分页
                  </div>
                </div>
              </>
            )}

            {activeTab === 'cover' && (
              <>
                <div className="cover-preview">
                  <div className="cover-preview-title">
                    {coverTitle || '点击下方输入标题'}
                  </div>
                </div>
                <label className="cover-label">封面标题</label>
                <input
                  className="cover-input"
                  placeholder="输入封面标题"
                  value={coverTitle}
                  onChange={e => setCoverTitle(e.target.value)}
                />
                <label className="cover-label">副标题</label>
                <input
                  className="cover-input"
                  placeholder="输入副标题（可选）"
                  value={coverSubtitle}
                  onChange={e => setCoverSubtitle(e.target.value)}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-left">
          <span>字数：{wordCount}</span>
          <span>自动保存于 {formatTime(lastSaved)}</span>
        </div>
        <div className="status-right">
          <button className="btn-secondary">暂存离开</button>
          <button className="btn-primary" onClick={() => setShowExportModal(true)}>
            下一步
          </button>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowExportModal(false)}>×</button>
            <div className="modal-title">导出笔记</div>
            <div className="modal-info">
              将导出 <strong>{contentPages.length}</strong> 页为 JPG 图片
            </div>
            <div className="modal-buttons">
              <button
                className="modal-btn primary"
                onClick={handleExport}
              >
                导出全部 JPG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isExporting && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <div className="loading-text">正在导出第 {Math.round(exportProgress / 100 * contentPages.length)} / {contentPages.length} 页...</div>
          <div className="loading-progress">
            <div className="loading-progress-bar" style={{ width: `${exportProgress}%` }} />
          </div>
          <div className="loading-percent">{exportProgress}%</div>
        </div>
      )}
    </div>
  )
}

export default App
