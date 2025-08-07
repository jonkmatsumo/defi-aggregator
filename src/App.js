import React from 'react';
import WalletProvider from './components/WalletProvider';
import WalletConnection from './components/WalletConnection';
import './App.css';

function App() {
  return (
    <WalletProvider>
      <div className="App">
        <header className="App-header">
          <h1>DeFi Aggregator</h1>
          <p>
            Welcome to your DeFi aggregator! Connect your wallet to get started.
          </p>
          <WalletConnection />
        </header>
      </div>
    </WalletProvider>
  );
}

export default App;
