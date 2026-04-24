import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout({ children }) {
  return (
    <div className="flex h-screen bg-paper">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 ml-60 flex flex-col">
        {/* TopBar */}
        <TopBar />

        {/* Content */}
        <main className="flex-1 overflow-auto mt-16 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
