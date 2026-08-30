import { Outlet } from 'react-router-dom';

export function DashboardPage(): JSX.Element {
  return (
    <div className="flex-1 h-full relative">
      <Outlet />
    </div>
  );
}