import { useState, useEffect } from 'react'
import './App.css'
import Dashboard from './Dashboard'

interface Item {
  id: string
  name: string
  description: string
}

function Items({ apiKey }: { apiKey: string }) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const apiTarget = import.meta.env.VITE_API_TARGET

  useEffect(() => {
    if (!apiKey) return

    const fetchItems = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`${apiTarget}/items`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data: Item[] = await response.json()
        setItems(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch items')
      } finally {
        setLoading(false)
      }
    }

    fetchItems()
  }, [apiKey, apiTarget])

  if (!apiKey) return <p>Please enter your API key above</p>
  if (loading) return <p>Loading items...</p>
  if (error) return <p className="error">Error: {error}</p>

  return (
    <div>
      <h2>Items</h2>
      {items.length === 0 ? (
        <p>No items found</p>
      ) : (
        <pre>{JSON.stringify(items, null, 2)}</pre>
      )}
    </div>
  )
}

type Page = 'items' | 'dashboard'

function App() {
  const [apiKey, setApiKey] = useState('')
  const [currentPage, setCurrentPage] = useState<Page>('items')

  useEffect(() => {
    const savedKey = localStorage.getItem('api_key')
    if (savedKey) {
      setApiKey(savedKey)
    }
  }, [])

  const handleApiKeyChange = (key: string) => {
    setApiKey(key)
    if (key) {
      localStorage.setItem('api_key', key)
    } else {
      localStorage.removeItem('api_key')
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Learning Management Service</h1>
        <div className="api-key-input">
          <label htmlFor="api-key">API Key: </label>
          <input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder="Enter your API key"
          />
        </div>
        <nav className="nav">
          <button
            onClick={() => setCurrentPage('items')}
            className={currentPage === 'items' ? 'active' : ''}
          >
            Items
          </button>
          <button
            onClick={() => setCurrentPage('dashboard')}
            className={currentPage === 'dashboard' ? 'active' : ''}
          >
            Dashboard
          </button>
        </nav>
      </header>

      <main>
        {currentPage === 'items' ? (
          <Items apiKey={apiKey} />
        ) : (
          <Dashboard />
        )}
      </main>
    </div>
  )
}

export default App
