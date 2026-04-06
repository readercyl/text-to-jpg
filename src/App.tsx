import { useState, useEffect, useRef, useCallback } from 'react'
import html2canvas from 'html2canvas'
import './App.css'

type PageType = 'title' | 'content'

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

function generateId() {
  return Math.random().toString(36).substr(2, 9)
}

function App() {
  const [pages, setPages] = useState<Page[]>([
    { id: generateId(), type: 'title', title: '', content: '' },
    { id: generateId(), type: 'content', title: '', content: '' },
    { id: generateId(), type: 'content', title: '', content: '' },
  ])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [template, setTemplate] = useState<TemplateId>('simple')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [wordCount, setWordCount] = useState(0)
  const [lastSaved, setLastSaved] = useState(new Date())
  const [activeFormats, setActiveFormats] = useState({ bold: false, underline: false })

  const contentRefs = useRef<(HTMLDivElement | null)[]>([])
  const editorAreaRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<Selection | null>(null)

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastSaved(new Date())
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Calculate word count - only count text content (exclude HTML tags)
  useEffect(() => {
    let totalText = ''
    pages.forEach(page => {
      totalText += page.title + ' ' + page.content + ' '
    })
    // Strip HTML tags and count characters
    const text = totalText.replace(/<[^>]*>/g, '').replace(/\s/g, '')
    setWordCount(text.length)
  }, [pages])

  // Listen for selection changes to update toolbar state
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        selectionRef.current = selection
        try {
          setActiveFormats({
            bold: document.queryCommandState('bold'),
            underline: document.queryCommandState('underline'),
          })
        } catch {
          setActiveFormats({ bold: false, underline: false })
        }
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [])

  // Toolbar formatting commands
  const formatBold = () => {
    document.execCommand('bold', false)
    updateActiveFormats()
  }

  const formatUnderline = () => {
    document.execCommand('underline', false)
    updateActiveFormats()
  }

  const formatH1 = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const container = range.commonAncestorContainer

    // Find the content editable element
    const editableEl = container.nodeType === 1
      ? container as HTMLElement
      : container.parentElement as HTMLElement

    if (editableEl && editableEl.classList.contains('page-content-editable')) {
      document.execCommand('formatBlock', false, '<h1>')
    }
  }

  const formatH2 = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const container = range.commonAncestorContainer

    const editableEl = container.nodeType === 1
      ? container as HTMLElement
      : container.parentElement as HTMLElement

    if (editableEl && editableEl.classList.contains('page-content-editable')) {
      document.execCommand('formatBlock', false, '<h2>')
    }
  }

  const formatOrderedList = () => {
    document.execCommand('insertOrderedList', false)
  }

  const formatUnorderedList = () => {
    document.execCommand('insertUnorderedList', false)
  }

  const formatBlockquote = () => {
    document.execCommand('formatBlock', false, '<blockquote>')
  }

  const changeFont = (fontName: string) => {
    document.execCommand('fontName', false, fontName)
  }

  const updateActiveFormats = () => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      underline: document.queryCommandState('underline'),
    })
  }

  // Insert emoji at cursor
  const insertEmoji = (emoji: string) => {
    document.execCommand('insertText', false, emoji)
    setShowEmojiPicker(false)
  }

  // Handle content change with auto-pagination
  const handleContentChange = useCallback((pageIndex: number) => {
    const contentEl = contentRefs.current[pageIndex]
    if (!contentEl) return

    const text = contentEl.innerHTML
    setPages(prev => prev.map((p, i) => i === pageIndex ? { ...p, content: text } : p))

    // Check if content overflows
    checkAndSplitContent(pageIndex)
  }, [])

  // Check if content overflows and create new page
  const checkAndSplitContent = useCallback((pageIndex: number) => {
    const contentEl = contentRefs.current[pageIndex]
    if (!contentEl) return

    const scrollHeight = contentEl.scrollHeight
    const clientHeight = contentEl.clientHeight

    // If content overflows, we need to split it
    if (scrollHeight > clientHeight + 5) {
      // Get all content
      const fullHTML = contentEl.innerHTML
      const fullText = contentEl.innerText

      // Calculate approximate split point
      const lineHeight = 27
      const charsPerLine = Math.floor(clientHeight / lineHeight) * 30
      const lines = fullText.split('\n')
      let accumulatedChars = 0
      let splitIndex = 0

      for (let i = 0; i < lines.length; i++) {
        accumulatedChars += lines[i].length + 1
        if (accumulatedChars > charsPerLine * 0.8) {
          splitIndex = i
          break
        }
      }

      if (splitIndex >= lines.length - 1) splitIndex = lines.length - 2
      if (splitIndex < 0) splitIndex = 0

      // Split the HTML content
      const currentLines = lines.slice(0, splitIndex + 1)
      const nextLines = lines.slice(splitIndex + 1)

      // Create simple text version
      const currentText = currentLines.join('\n')

      // Find where in the HTML the split should occur
      let currentHTML = ''
      let nextHTML = ''
      let charCount = 0
      let inTag = false
      let i = 0

      while (i < fullHTML.length && charCount <= currentText.length) {
        const char = fullHTML[i]
        if (char === '<') inTag = true
        if (!inTag) charCount++
        currentHTML += char
        if (char === '>') inTag = false
        i++
      }

      // Find a good breaking point (end of a tag or paragraph)
      while (i < fullHTML.length) {
        const char = fullHTML[i]
        if (char === '<' && fullHTML.substring(i, i + 4) === '<div') {
          break
        }
        nextHTML += char
        i++
      }

      // Clean up the split HTML
      if (!nextHTML.trim()) {
        nextHTML = nextLines.join('<br>')
      }

      // Store nextHTML for use in setTimeout
      const finalNextHTML = nextHTML

      // Update pages
      setPages(prev => {
        const newPages = [...prev]

        // Update current page content
        newPages[pageIndex] = { ...newPages[pageIndex], content: currentHTML }

        // Check if next page exists
        if (pageIndex + 1 < newPages.length) {
          // Append to existing next page
          const nextContent = newPages[pageIndex + 1].content || ''
          newPages[pageIndex + 1] = {
            ...newPages[pageIndex + 1],
            content: nextContent + finalNextHTML
          }
        } else {
          // Create new page
          newPages.push({
            id: generateId(),
            type: 'content',
            title: '',
            content: finalNextHTML
          })
        }

        return newPages
      })

      // Update the DOM after state update
      setTimeout(() => {
        // Update current editor
        if (contentRefs.current[pageIndex]) {
          contentRefs.current[pageIndex]!.innerHTML = currentHTML
        }

        // Update next editor
        if (contentRefs.current[pageIndex + 1]) {
          contentRefs.current[pageIndex + 1]!.innerHTML = pages[pageIndex + 1]?.content + finalNextHTML || finalNextHTML
          // Scroll to make new card visible
          contentRefs.current[pageIndex + 1]!.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } else if (editorAreaRef.current) {
          // New card was created, scroll to it
          const cards = editorAreaRef.current.querySelectorAll('.page-card')
          cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 50)
    }
  }, [pages])

  // Handle backspace to merge pages
  const handleKeyDown = useCallback((e: React.KeyboardEvent, pageIndex: number) => {
    const contentEl = contentRefs.current[pageIndex]
    if (!contentEl) return

    // Check if content is empty and we should merge with previous page
    if (e.key === 'Backspace' && contentEl.innerText.trim() === '') {
      if (pageIndex > 0) {
        e.preventDefault()

        const prevContent = contentRefs.current[pageIndex - 1]
        const currentContent = pages[pageIndex].content

        if (prevContent) {
          // Merge content into previous page
          const mergedContent = prevContent.innerHTML + currentContent
          prevContent.innerHTML = mergedContent

          // Update state
          setPages(prev => {
            const newPages = [...prev]
            newPages[pageIndex - 1] = {
              ...newPages[pageIndex - 1],
              content: mergedContent
            }
            newPages.splice(pageIndex, 1)
            return newPages
          })

          // Focus previous page
          setTimeout(() => {
            prevContent.focus()
            // Move cursor to end
            const range = document.createRange()
            range.selectNodeContents(prevContent)
            range.collapse(false)
            const selection = window.getSelection()
            selection?.removeAllRanges()
            selection?.addRange(range)
          }, 50)
        }
      }
    }

    // Handle Enter for list items
    if (e.key === 'Enter' && !e.shiftKey) {
      // Let the default behavior handle list creation
    }
  }, [pages])

  // Insert image
  const insertImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (evt) => {
          const src = evt.target?.result as string
          document.execCommand('insertImage', false, src)
        }
        reader.readAsDataURL(file)
      }
    }
    input.click()
  }

  // Go to page
  const goToPage = (index: number) => {
    if (index >= 0 && index < pages.length) {
      setCurrentPageIndex(index)
      setTimeout(() => {
        contentRefs.current[index]?.focus()
      }, 50)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  // Export to JPG
  const handleExport = async () => {
    setShowExportModal(false)
    setIsExporting(true)
    setExportProgress(0)

    await new Promise(resolve => setTimeout(resolve, 100))

    const pageCards = document.querySelectorAll('.page-card')
    const totalPages = pages.length

    try {
      for (let i = 0; i < pageCards.length; i++) {
        const card = pageCards[i] as HTMLElement
        const canvas = await html2canvas(card, {
          scale: 2,
          backgroundColor: getComputedStyle(card).backgroundColor,
          useCORS: true,
          logging: false,
        })

        const link = document.createElement('a')
        link.download = `第${i + 1}页.jpg`
        link.href = canvas.toDataURL('image/jpeg', 0.95)
        link.click()

        setExportProgress(Math.round(((i + 1) / totalPages) * 100))
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    } catch (error) {
      console.error('Export failed:', error)
    }

    setIsExporting(false)
  }

  const themeClass = template === 'warm' ? 'warm' : template === 'dark' ? 'dark' : ''

  return (
    <div className="app" data-theme={themeClass}>
      {/* Toolbar */}
      <div className="toolbar">
        <button className="toolbar-btn" title="撤销">↩</button>
        <button className="toolbar-btn" title="重做">↪</button>
        <div className="toolbar-divider" />
        <button className="toolbar-btn toolbar-btn-text" title="H1标题" onClick={formatH1}><strong>H1</strong></button>
        <button className="toolbar-btn toolbar-btn-text" title="H2标题" onClick={formatH2}><strong>H2</strong></button>
        <div className="toolbar-divider" />
        <button
          className={`toolbar-btn toolbar-btn-text ${activeFormats.bold ? 'active' : ''}`}
          title="加粗"
          onClick={formatBold}
        >
          <strong>B</strong>
        </button>
        <button
          className={`toolbar-btn toolbar-btn-text ${activeFormats.underline ? 'active' : ''}`}
          title="下划线"
          onClick={formatUnderline}
        >
          <u>U</u>
        </button>
        <div className="toolbar-divider" />
        <button className="toolbar-btn toolbar-btn-text" title="有序列表" onClick={formatOrderedList}>1.</button>
        <button className="toolbar-btn toolbar-btn-text" title="无序列表" onClick={formatUnorderedList}>•</button>
        <button className="toolbar-btn" title="引用" onClick={formatBlockquote}>❝</button>
        <div className="toolbar-divider" />
        <select
          className="font-select"
          onChange={(e) => changeFont(e.target.value)}
          defaultValue=""
        >
          <option value="" disabled>字体</option>
          <option value="默认">默认</option>
          <option value="宋体">宋体</option>
          <option value="楷体">楷体</option>
          <option value="黑体">黑体</option>
        </select>
        <div className="toolbar-divider" />
        <button className="toolbar-btn" title="插入图片" onClick={insertImage}>🖼</button>
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
        <div className="editor-area" ref={editorAreaRef}>
          <div className="pages-container">
            {pages.map((page, index) => (
              <div
                key={page.id}
                className={`page-card ${page.type === 'title' ? 'title-page' : 'content-page'} ${index === currentPageIndex ? 'editing' : ''}`}
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
                      onClick={e => e.stopPropagation()}
                    />
                    <div
                      ref={el => { contentRefs.current[index] = el }}
                      className="page-content-editable"
                      contentEditable
                      suppressContentEditableWarning
                      onInput={() => handleContentChange(index)}
                      onKeyDown={e => handleKeyDown(e, index)}
                      onClick={e => { e.stopPropagation(); goToPage(index) }}
                      data-placeholder="输入正文..."
                    />
                  </>
                )}

                {page.type === 'content' && (
                  <div
                    ref={el => { contentRefs.current[index] = el }}
                    className="page-content-editable content-only"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => handleContentChange(index)}
                    onKeyDown={e => handleKeyDown(e, index)}
                    onClick={e => { e.stopPropagation(); goToPage(index) }}
                    data-placeholder="输入正文..."
                  />
                )}

                <div className="page-number-indicator">
                  {index === currentPageIndex ? (
                    <span className="current-page-label">当前编辑</span>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Side Panel */}
        <div className="side-panel">
          <div className="panel-header">
            <span className="panel-title">选择模板</span>
          </div>

          <div className="panel-content">
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
                <span>当前共 {pages.length} 页内容</span>
              </div>
            </div>

            <div className="template-section">
              <div className="template-section-title">分页提示</div>
              <div className="template-hint">
                内容超出卡片高度时自动分页
              </div>
            </div>
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
              将导出 <strong>{pages.length}</strong> 页为 JPG 图片
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
          <div className="loading-text">正在导出...</div>
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
