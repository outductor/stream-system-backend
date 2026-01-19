import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Temporal } from 'temporal-polyfill'
import { StreamViewer } from './pages/StreamViewer'
import { Timetable } from './pages/Timetable'
import { EventTimezoneContext } from './hooks/useEventTimezone'
import { configApi } from './api/client'
import './App.css'

function App() {
  const [timezone, setTimezone] = useState<string>(Temporal.Now.timeZoneId());

  useEffect(() => {
    configApi.getEventConfig()
      .then(config => setTimezone(config.timezone))
      .catch(console.error);
  }, []);

  return (
    <EventTimezoneContext.Provider value={timezone}>
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
    </EventTimezoneContext.Provider>
  )
}

export default App
