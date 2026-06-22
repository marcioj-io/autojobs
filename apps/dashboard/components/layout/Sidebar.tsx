'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import ReviewsOutlinedIcon from '@mui/icons-material/ReviewsOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';

const menuItems = [
  { label: 'Dashboard', href: '/', icon: HomeOutlinedIcon },
  { label: 'Jobs', href: '/jobs', icon: WorkOutlineOutlinedIcon },
  { label: 'Manual Review', href: '/manual-review', icon: ReviewsOutlinedIcon },
  { label: 'Profiles', href: '/profiles', icon: PersonOutlineOutlinedIcon },
  { label: 'Settings', href: '/settings', icon: SettingsOutlinedIcon },
  { label: 'Logs', href: '/logs', icon: ListAltOutlinedIcon }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 flex-col border-r border-slate-800 bg-slate-950 p-6 text-slate-100 lg:flex">
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300">
          AJ
        </div>
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-300/80">AutoJobs</p>
          <p className="text-lg font-semibold text-slate-100">Painel</p>
        </div>
      </div>

      <nav className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex w-full items-center gap-3 rounded-3xl px-4 py-3 text-left text-sm font-medium transition ${
                isActive ? 'bg-slate-900 text-white shadow-glow' : 'text-slate-200 hover:bg-slate-900/80 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5 text-sky-300" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-3xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        <p className="text-slate-100">Status</p>
        <p className="mt-2">Monitorando 3 perfis de busca</p>
      </div>
    </aside>
  );
}
