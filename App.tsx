
import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import PracticeRoom from './views/PracticeRoom';
import VocabularyRoom from './views/VocabularyRoom';
import ListeningRoom from './views/ListeningRoom';
import DocumentLibrary from './views/DocumentLibrary';
import { TaskProvider } from './context/TaskContext';

const App: React.FC = () => {
  return (
    <TaskProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/practice" element={<PracticeRoom />} />
            <Route path="/vocabulary" element={<VocabularyRoom />} />
            <Route path="/listening" element={<ListeningRoom />} />
            <Route path="/documents" element={<DocumentLibrary />} />
          </Routes>
        </Layout>
      </Router>
    </TaskProvider>
  );
};

export default App;
