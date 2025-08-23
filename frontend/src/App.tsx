import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { StreamViewer } from './pages/StreamViewer'
import { Timetable } from './pages/Timetable'
import './App.css'

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="nav">
          <Link to="/" className="nav-link">ライブ配信</Link>
          <Link to="/timetable" className="nav-link">タイムテーブル</Link>
        </nav>
        
        <main className="main">
          <Routes>
            <Route path="/" element={<StreamViewer />} />
            <Route path="/timetable" element={<Timetable />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
