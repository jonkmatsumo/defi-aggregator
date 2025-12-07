import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WalletProvider from './components/WalletProvider';
import Header from './components/Header';
import DashboardRoute from './routes/DashboardRoute';
import ChatRoute from './routes/ChatRoute';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <div className="App">
          {/* Header remains outside error boundary to stay visible during errors */}
          <Header />
          
          {/* Routes */}
          <Routes>
            <Route path="/" element={<ChatRoute />} />
            <Route path="/chat" element={<ChatRoute />} />
            <Route path="/dashboard" element={<DashboardRoute />} />
          </Routes>
        </div>
      </WalletProvider>
    </BrowserRouter>
  );
}

export default App;
