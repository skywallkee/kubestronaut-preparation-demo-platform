import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ExamSelection from './pages/ExamSelection';
import ExamInterface from './components/ExamInterface/ExamInterface';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<ExamSelection />} />
          <Route path="/exam" element={<ExamInterface />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;