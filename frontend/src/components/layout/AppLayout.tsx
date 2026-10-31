import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { TickerBar } from './TickerBar';
import { Footer } from './Footer';
import { useWebSocket } from '../../hooks/useWebSocket';

export const AppLayout: React.FC = () => {
  const { isConnected, refreshData } = useWebSocket();

  return (
    <div className="min-h-screen bg-byte-bg text-byte-primary flex flex-col font-sans antialiased selection:bg-byte-accent/20 selection:text-byte-accent transition-colors duration-150">
      <Navbar isConnected={isConnected} onResetCompleted={refreshData} />
      <TickerBar />
      <main className="flex-1 flex flex-col w-full max-w-[1780px] mx-auto px-3 sm:px-5 py-4">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
