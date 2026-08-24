import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { NavMenuItem } from './navData';

interface NavItemProps {
  item: NavMenuItem;
}

export default function NavItem({ item }: NavItemProps) {
  const [isOpen, setIsOpen] = useState(false)

  const hasOptions = item.items && item.items.length > 0;

  return (
    <div
      className='relative group'
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <Link to={hasOptions ? '#' : item.Tpath}>
        <button className='flex items-center gap-1 hover:text-emerald-400 transition py-2 font-bold text-sm'>
          {item.title}

          {hasOptions && (
            <svg
              className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M19 9l-7 7-7-7' />
            </svg>
          )}
        </button>
      </Link>

      {hasOptions && isOpen && (
        <div className='absolute top-full left-0 w-48 bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xl rounded-xl py-2 mt-0 border border-emerald-500/10 z-[60]'>
          {item.items!.map((opt: any) => (
            <Link
              key={opt.path || opt.label}
              to={opt.path}
              className='block px-4 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 transition text-xs font-bold'
            >
              {opt.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
