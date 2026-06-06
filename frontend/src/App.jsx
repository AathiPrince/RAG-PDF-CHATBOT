import { useState, useRef, useEffect } from 'react'
import axios from 'axios'

const API_URL = 'http://localhost:8000'

function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! Please upload a PDF to start.' }
  ])
  const [input, setInput] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleClear = async () => {
    try {
      const response = await axios.post(`${API_URL}/clear`)
      setUploadStatus(response.data.message)
      setMessages([{ role: 'assistant', content: 'Knowledge base cleared.' }])
    } catch (error) {
      setUploadStatus('Failed to clear.')
    }
  }

  const handleFileUpload = async (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setUploadStatus('Uploading document...')

    const formData = new FormData()
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i])
    }

    try {
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setUploadStatus(response.data.message)
    } catch (error) {
      console.error(error)
      setUploadStatus(error.response?.data?.detail || 'Upload failed.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || isTyping) return

    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setIsTyping(true)

    try {
      const response = await axios.post(`${API_URL}/chat`, {
        message: userMsg
      })
      setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }])
    } catch (error) {
      console.error(error)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error getting response.' }])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans text-gray-800">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-[90vh]">
        
        {/* Header */}
        <div className="bg-blue-600 text-white p-6">
          <h1 className="text-2xl font-bold text-center">KEA RAG</h1>
          <p className="text-center text-blue-200 mt-1">Chat with your PDF documents</p>
        </div>

        {/* Controls */}
        <div className="bg-gray-50 border-b p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload} 
              accept=".pdf" 
              multiple 
              disabled={isUploading}
              className="file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
            <button 
              onClick={handleClear} 
              disabled={isUploading}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
            >
              Clear DB
            </button>
          </div>
          {uploadStatus && (
            <div className="text-sm font-medium text-blue-600">
              {uploadStatus}
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-4 ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-white border border-gray-200 text-gray-800 shadow-sm rounded-bl-none'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-200 text-gray-500 rounded-lg p-4 rounded-bl-none">
                  Bot is typing...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder="Ask a question..."
              disabled={isTyping}
              className="flex-1 border border-gray-300 rounded px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <button 
              type="submit" 
              disabled={!input.trim() || isTyping}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded font-medium transition-colors"
            >
              Send
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}

export default App
