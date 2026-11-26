
import {
  Search,
  X,
  SlidersHorizontal,
  ListFilter,
  Flag,
  Users,
  ChevronDown,
  Filter,
} from 'lucide-react';

import {
  PRIORITIES,
  STATUSES,
} from '../../lib/constants.js';

// ==========================================
// DEFAULT FILTER VALUES
// ==========================================

export const EMPTY_FILTERS = {
  q: '',
  status: '',
  priority: '',
  assignee: '',
};

// ==========================================
// REUSABLE PREMIUM FILTER SELECT
// ==========================================

function FilterSelect({
  icon: Icon,
  label,
  value,
  onChange,
  children,
}) {
  return (
    <label className="block min-w-0">

      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-600">

        <Icon
          size={14}
          strokeWidth={1.8}
          className="text-pulse-700"
        />

        {label}

      </span>

      <div className="relative">

        <select
          value={value}
          onChange={onChange}
          aria-label={`Filter by ${label.toLowerCase()}`}
          className={`input w-full appearance-none !rounded-lg !py-2.5 !pr-8 text-sm transition-colors hover:border-pulse-300 ${
            value
              ? '!border-pulse-400 !bg-pulse-50 !text-pulse-800'
              : '!bg-ink-50'
          }`}
        >

          {children}

        </select>

        <ChevronDown
          size={15}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"
        />

      </div>

    </label>
  );
}

// ==========================================
// PREMIUM SEARCH AND FILTER BAR
// ==========================================

export default function FilterBar({
  filters,
  onChange,
  members,
  resultCount,
  total,
}) {
  const set = (key) => (event) => {
    onChange({
      ...filters,
      [key]: event.target.value,
    });
  };

  const active =
    Object.values(filters).some(Boolean);

  const activeCount =
    Object.values(filters).filter(Boolean).length;

  function clearFilters() {
    onChange({ ...EMPTY_FILTERS });
  }

  function clearSearch() {
    onChange({
      ...filters,
      q: '',
    });
  }

  return (
    <section
      aria-label="Task search and filters"
      className="mb-5 min-w-0 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm"
    >

      {/* ==========================================
          FILTER BAR HEADER
          ========================================== */}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pulse-100 bg-gradient-to-r from-pulse-50 via-white to-white px-4 py-3.5">

        <div className="flex min-w-0 items-center gap-3">

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-pulse-200 bg-pulse-100 text-pulse-700">

            <SlidersHorizontal
              size={20}
              strokeWidth={1.8}
            />

          </div>

          <div>

            <h3 className="text-sm font-bold text-ink-900">
              Search & filters
            </h3>

            <p className="mt-0.5 text-xs text-ink-500">
              Find the tasks that matter.
            </p>

          </div>

        </div>

        {/* Dynamic result count */}

        <span
          aria-live="polite"
          className="inline-flex shrink-0 items-center rounded-lg border border-pulse-200 bg-pulse-50 px-3 py-1.5 text-xs font-semibold tabular-nums text-pulse-800"
        >

          {active
            ? `${resultCount} of ${total} tasks`
            : `${total} ${total === 1 ? 'task' : 'tasks'}`}

        </span>

      </div>

      {/* ==========================================
          SEARCH AND FILTER CONTROLS
          ========================================== */}

      <div className="p-4">

        <div className="grid min-w-0 grid-cols-1 items-end gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">

          {/* ==========================================
              TASK SEARCH
              ========================================== */}

          <div className="min-w-0">

            <label
              htmlFor="task-search"
              className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-600"
            >

              <Search
                size={14}
                className="text-pulse-700"
              />

              Search tasks

            </label>

            <div className="relative">

              <Search
                size={17}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
              />

              <input
                id="task-search"
                type="text"
                value={filters.q}
                onChange={set('q')}
                placeholder="Search tasks by title..."
                autoComplete="off"
                className="input w-full !rounded-lg !bg-ink-50 !py-2.5 !pl-10 !pr-9 text-sm transition-colors hover:border-pulse-300 focus:!bg-white"
              />

              {filters.q && (

                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  title="Clear search"
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                >

                  <X size={15} />

                </button>

              )}

            </div>

          </div>

          {/* ==========================================
              STATUS FILTER
              ========================================== */}

          <FilterSelect
            icon={ListFilter}
            label="Status"
            value={filters.status}
            onChange={set('status')}
          >

            <option value="">
              All statuses
            </option>

            {STATUSES.map((status) => (

              <option
                key={status.id}
                value={status.id}
              >
                {status.label}
              </option>

            ))}

          </FilterSelect>

          {/* ==========================================
              PRIORITY FILTER
              ========================================== */}

          <FilterSelect
            icon={Flag}
            label="Priority"
            value={filters.priority}
            onChange={set('priority')}
          >

            <option value="">
              All priorities
            </option>

            {PRIORITIES.map((priority) => (

              <option
                key={priority.id}
                value={priority.id}
              >
                {priority.label}
              </option>

            ))}

          </FilterSelect>

          {/* ==========================================
              ASSIGNEE FILTER
              ========================================== */}

          <FilterSelect
            icon={Users}
            label="Assignee"
            value={filters.assignee}
            onChange={set('assignee')}
          >

            <option value="">
              Anyone
            </option>

            <option value="none">
              Unassigned
            </option>

            {members.map((member) => (

              <option
                key={member.id}
                value={member.id}
              >
                {member.name}
              </option>

            ))}

          </FilterSelect>

        </div>

        {/* ==========================================
            ACTIVE FILTER SUMMARY
            ========================================== */}

        {active && (

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pulse-200 bg-gradient-to-r from-pulse-50 to-white px-3.5 py-3">

            <div className="flex min-w-0 items-center gap-2.5">

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pulse-100 text-pulse-700">

                <Filter
                  size={16}
                  strokeWidth={1.8}
                />

              </div>

              <div>

                <p className="text-xs font-bold text-pulse-800">

                  {activeCount}{' '}

                  {activeCount === 1
                    ? 'active filter'
                    : 'active filters'}

                </p>

                <p className="mt-0.5 text-xs text-ink-500">

                  Showing {resultCount} of {total} tasks

                </p>

              </div>

            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-pulse-200 bg-white px-3 py-2 text-xs font-semibold text-pulse-800 transition-colors hover:border-pulse-400 hover:bg-pulse-100"
            >

              <X size={14} />

              Clear filters

            </button>

          </div>

        )}

      </div>

    </section>
  );
}