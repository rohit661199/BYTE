import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { useWebSocket } from '../../hooks/useWebSocket';

export const PublicLayout: React.FC = () => {
  const { isConnected, refreshData } = useWebSocket();

  return (
    <div className="min-h-screen bg-byte-bg text-byte-primary flex flex-col font-sans antialiased selection:bg-byte-accent/20 selection:text-byte-accent transition-colors duration-150">
      <Navbar isConnected={isConnected} onResetCompleted={refreshData} />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
