import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import Login from './components/Login'
import PersonDetail from './components/PersonDetail'
import SearchPage from './components/SearchPage'
import GraphPage from './components/GraphPage'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [selectedPersonId, setSelectedPersonId] = useState(null)
  const token = localStorage.getItem('memoir_token')

  useEffect(() => {
    const storedToken = localStorage.getItem('memoir_token')
    setIsAuthenticated(!!storedToken)
    setIsLoading(false)
  }, [])

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-parchment)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '2px solid var(--color-sepia)',
          borderTopColor: 'var(--color-gold)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  const handleLogout = () => {
    localStorage.removeItem('memoir_token')
    localStorage.removeItem('memoir_user')
    localStorage.removeItem('memoir_user_id')
    setIsAuthenticated(false)
    setCurrentPage('dashboard')
  }

  const handlePersonClick = (personId) => {
    setSelectedPersonId(personId)
    setCurrentPage('person')
  }

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />
  }

  switch (currentPage) {
    case 'person':
      return <PersonDetail personId={selectedPersonId} onBack={() => setCurrentPage('dashboard')} token={token} />
    case 'search':
      return <SearchPage onBack={() => setCurrentPage('dashboard')} token={token} />
    case 'graph':
      return <GraphPage onBack={() => setCurrentPage('dashboard')} token={token} />
    default:
      return <Dashboard onLogout={handleLogout} onPersonClick={handlePersonClick} onSearchClick={() => setCurrentPage('search')} onGraphClick={() => setCurrentPage('graph')} />
  }
}

export default App
