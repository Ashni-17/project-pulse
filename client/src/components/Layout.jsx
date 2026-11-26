
import { useCallback, useEffect, useState } from 'react';

import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  LayoutDashboard,
  LogOut,
  Menu,
  FolderKanban,
  Plus,
  X,
  ChevronRight,
} from 'lucide-react';

import clsx from 'clsx';

import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

import { Avatar } from './ui';

import ProjectFormModal from './project/ProjectFormModal.jsx';


// ==========================================
// ANIMATED PULSE LOGO
// ==========================================

function PulseLogo({ size = 38 }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10"
      style={{
        width: size,
        height: size,
      }}
    >
      <svg
        viewBox="0 0 40 40"
        className="h-4/5 w-4/5"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2 21H11L15 10L22 31L27 16L30 21H38"
          stroke="#69e6c6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.25"
        />

        <path
          d="M2 21H11L15 10L22 31L27 16L30 21H38"
          stroke="#69e6c6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="100"
          className="sidebar-pulse-line"
        />
      </svg>
    </div>
  );
}


// ==========================================
// NAVIGATION STYLES
// ==========================================

const linkCls = ({ isActive }) =>
  clsx(
    'group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 motion-reduce:transition-none',

    isActive
      ? 'bg-gradient-to-r from-white/20 to-white/5 text-white shadow-sm'
      : 'text-pulse-100/80 hover:bg-white/10 hover:text-white'
  );


// ==========================================
// NAVIGATION CONTENT
// ==========================================

function NavigationContent({
  icon: Icon,
  label,
  isActive,
}) {
  return (
    <>
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-pulse-300"
        />
      )}

      <Icon
        size={19}
        strokeWidth={1.8}
        className={clsx(
          'shrink-0 transition-colors',
          isActive
            ? 'text-pulse-300'
            : 'text-pulse-200 group-hover:text-white'
        )}
      />

      <span className="min-w-0 flex-1 truncate">
        {label}
      </span>

      {isActive && (
        <ChevronRight
          size={15}
          className="shrink-0 text-pulse-300"
        />
      )}
    </>
  );
}


// ==========================================
// MAIN APPLICATION LAYOUT
// ==========================================

export default function Layout() {
  const { user, logout } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);


  // ==========================================
  // LOAD PROJECTS
  // ==========================================

  const refresh = useCallback(() => {
    return api
      .get('/projects')
      .then((data) => {
        setProjects(data.projects);
      })
      .catch(() => {});
  }, []);


  useEffect(() => {
    refresh();
  }, [refresh, location.pathname]);


  useEffect(() => {
    window.addEventListener(
      'pulse:projects-changed',
      refresh
    );

    return () => {
      window.removeEventListener(
        'pulse:projects-changed',
        refresh
      );
    };
  }, [refresh]);


  // Close mobile navigation after changing pages.

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);


  // Close mobile navigation using Escape.

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown
      );
    };
  }, [open]);


  // ==========================================
  // CURRENT PAGE INFORMATION
  // ==========================================

  const isDashboard = location.pathname === '/';

  const activeProject = projects.find(
    (project) =>
      location.pathname === `/projects/${project.id}` ||
      location.pathname.startsWith(
        `/projects/${project.id}/`
      )
  );

  const pageTitle = isDashboard
    ? 'Dashboard'
    : activeProject?.name || 'Workspace';


  function openCreateProject() {
    setOpen(false);
    setCreating(true);
  }


  // ==========================================
  // USER INTERFACE
  // ==========================================

  return (
    <div className="min-h-screen bg-ink-50 lg:pl-64">

      {/* Heartbeat animation */}

      <style>{`
        .sidebar-pulse-line {
          stroke-dasharray: 28 72;
          animation: sidebar-heartbeat 1.8s linear infinite;
          filter: drop-shadow(0 0 3px #30d0ab);
        }

        @keyframes sidebar-heartbeat {
          from {
            stroke-dashoffset: 100;
          }
          to {
            stroke-dashoffset: 0;
          }
        }

        .pulse-sidebar-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.2) transparent;
        }

        .pulse-sidebar-scroll::-webkit-scrollbar {
          width: 4px;
        }

        .pulse-sidebar-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
          border-radius: 10px;
        }

        @media (prefers-reduced-motion: reduce) {
          .sidebar-pulse-line {
            animation: none;
            stroke-dasharray: none;
          }
        }
      `}</style>


      {/* ==========================================
          PREMIUM MINT TOP NAVIGATION
          ========================================== */}

      <header className="sticky top-0 z-30 border-b border-pulse-200 bg-gradient-to-r from-pulse-50 via-pulse-100 to-pulse-200 shadow-sm">

        <div className="mx-auto flex min-h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">

          {/* Mobile menu and page title */}

          <div className="flex min-w-0 items-center gap-3">

            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-pulse-200 bg-white/70 text-pulse-800 transition-colors hover:border-pulse-400 hover:bg-white lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              aria-expanded={open}
              aria-controls="pulse-sidebar"
            >
              <Menu size={21} />
            </button>

            <div className="min-w-0">

              <p className="hidden text-xs font-medium text-pulse-700 sm:block">
                Your workspace
              </p>

              <p className="truncate text-base font-bold text-pulse-900 sm:text-lg">
                {pageTitle}
              </p>

            </div>

          </div>


          {/* Header user profile */}

          <div className="flex shrink-0 items-center gap-3">

            <div className="hidden text-right sm:block">

              <p className="max-w-[180px] truncate text-sm font-bold text-pulse-900">
                {user.name}
              </p>

              <p className="text-xs font-medium text-pulse-700">
                My workspace
              </p>

            </div>

            <Avatar
              name={user.name}
              className="!bg-pulse-800 !text-white !ring-pulse-100"
            />

          </div>

        </div>

      </header>


      {/* ==========================================
          MOBILE NAVIGATION OVERLAY
          ========================================== */}

      {open && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-ink-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}


      {/* ==========================================
          PREMIUM GRADIENT SIDEBAR
          ========================================== */}

      <aside
        id="pulse-sidebar"
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden bg-gradient-to-b from-[#092e28] via-pulse-900 to-pulse-700 text-white shadow-xl transition-transform duration-300 ease-in-out motion-reduce:transition-none lg:visible lg:translate-x-0',

          open
            ? 'visible translate-x-0'
            : 'invisible -translate-x-full'
        )}
      >

        {/* Decorative gradient background */}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full border border-white/5"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full border border-white/5"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-white/5"
        />


        {/* ==========================================
            BRANDING
            ========================================== */}

        <div className="relative flex items-center justify-between px-5 pb-6 pt-7">

          <NavLink
            to="/"
            onClick={() => setOpen(false)}
            className="flex min-w-0 items-center gap-3"
            aria-label="Pulse dashboard"
          >

            <PulseLogo size={42} />

            <div>

              <span className="font-display text-2xl font-bold tracking-tight text-white">
                Pulse
              </span>

              <p className="text-[10px] font-medium tracking-wide text-pulse-200">
                PROJECT MANAGEMENT
              </p>

            </div>

          </NavLink>

          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="rounded-lg p-2 text-pulse-200 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={19} />
          </button>

        </div>


        {/* ==========================================
            MAIN NAVIGATION
            ========================================== */}

        <nav
          aria-label="Main navigation"
          className="pulse-sidebar-scroll relative min-h-0 flex-1 overflow-y-auto px-3 pb-4"
        >

          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-pulse-200/70">
            Workspace
          </p>


          {/* Dashboard navigation */}

          <NavLink
            to="/"
            end
            className={linkCls}
            onClick={() => setOpen(false)}
          >
            {({ isActive }) => (
              <NavigationContent
                icon={LayoutDashboard}
                label="Dashboard"
                isActive={isActive}
              />
            )}
          </NavLink>


          {/* Projects heading */}

          <div className="mb-2 mt-8 flex items-center justify-between gap-2 px-3">

            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-pulse-200/70">
              Your projects
            </p>

            <button
              type="button"
              onClick={openCreateProject}
              aria-label="Create new project"
              title="Create new project"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-pulse-200 transition-colors hover:bg-white/15 hover:text-white"
            >
              <Plus size={17} />
            </button>

          </div>


          {/* Dynamic project navigation */}

          <div className="space-y-1.5">

            {projects.map((project) => (

              <NavLink
                key={project.id}
                to={`/projects/${project.id}`}
                className={linkCls}
                title={project.name}
                onClick={() => setOpen(false)}
              >

                {({ isActive }) => (
                  <NavigationContent
                    icon={FolderKanban}
                    label={project.name}
                    isActive={isActive}
                  />
                )}

              </NavLink>

            ))}

            {!projects.length && (
              <p className="px-3 py-3 text-sm text-pulse-200/70">
                No projects yet.
              </p>
            )}

          </div>


          {/* Quick create project */}

          <button
            type="button"
            onClick={openCreateProject}
            className="group mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/30 bg-white/5 px-3 py-3 text-sm font-semibold text-pulse-100 transition-all duration-200 hover:border-pulse-300 hover:bg-white/15 hover:text-white motion-reduce:transition-none"
          >

            <Plus
              size={18}
              className="transition-transform duration-200 group-hover:rotate-90 motion-reduce:transform-none"
            />

            New project

          </button>

        </nav>


        {/* ==========================================
            WORKSPACE BRAND CARD
            ========================================== */}

        <div className="relative mx-4 mb-4 rounded-xl border border-white/10 bg-white/5 p-4">

          <div className="flex items-center gap-2">

            <span className="relative flex h-2 w-2 shrink-0">

              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pulse-300 opacity-60 motion-reduce:animate-none" />

              <span className="relative inline-flex h-2 w-2 rounded-full bg-pulse-300" />

            </span>

            <p className="text-xs font-semibold text-white">
              Project Pulse
            </p>

          </div>

          <p className="mt-2 text-xs leading-relaxed text-pulse-200/80">
            Plan. Collaborate. Deliver.
          </p>

        </div>


        {/* ==========================================
            PREMIUM DARK USER PROFILE CARD
            ========================================== */}

        <div className="relative mx-3 mb-3 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-gradient-to-br from-[#071713] via-[#09251f] to-[#0b3931] p-3.5 shadow-lg">

          {/* Subtle decorative glow */}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-pulse-500/10"
          />

          <div className="relative flex items-center gap-3">

            {/* Mint green avatar */}

            <div className="shrink-0">

              <Avatar
                name={user.name}
                className="!bg-pulse-100 !text-pulse-900 !ring-pulse-400/30"
              />

            </div>

            {/* User information */}

            <div className="min-w-0 flex-1">

              <p
                className="truncate text-sm font-bold text-white"
                title={user.name}
              >
                {user.name}
              </p>

              <p
                className="mt-1 truncate text-xs text-pulse-200"
                title={user.email}
              >
                {user.email}
              </p>

            </div>

            {/* Logout button */}

            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-pulse-200 transition-colors hover:border-rose-400/30 hover:bg-rose-500/20 hover:text-rose-200"
            >
              <LogOut size={18} />
            </button>

          </div>

        </div>

      </aside>


      {/* ==========================================
          PAGE CONTENT
          ========================================== */}

      <main className="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:py-8">

        <Outlet />

      </main>


      {/* ==========================================
          PROJECT CREATION MODAL
          ========================================== */}

      {creating && (
        <ProjectFormModal
          onClose={() => setCreating(false)}
          onSaved={(project) => {
            setCreating(false);

            window.dispatchEvent(
              new Event('pulse:projects-changed')
            );

            navigate(`/projects/${project.id}`);
          }}
        />
      )}

    </div>
  );
}
