import { Outlet } from 'react-router-dom';

export function DashboardPage(): JSX.Element {
  return (
    <div className="dashboard">
      <Outlet />
    </div>
  );
}