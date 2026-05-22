import { CalendarDays, ListTodo, Target } from 'lucide-react'

export const PLANNER_HIGHLIGHTS = [
  {
    key: 'daily',
    title: 'Daily focus',
    hint: 'Habits & rhythms',
    icon: ListTodo,
    gradient: 'from-amber-400 to-orange-500',
    bg: 'bg-amber-50/90 ring-amber-300/50',
    text: 'text-amber-950',
  },
  {
    key: 'weekly',
    title: 'Weekly goals',
    hint: 'Milestones',
    icon: Target,
    gradient: 'from-emerald-400 to-teal-600',
    bg: 'bg-emerald-50/90 ring-emerald-300/50',
    text: 'text-emerald-950',
  },
  {
    key: 'monthly',
    title: 'Monthly themes',
    hint: 'Big picture',
    icon: CalendarDays,
    gradient: 'from-violet-500 to-fuchsia-600',
    bg: 'bg-violet-50/90 ring-violet-300/50',
    text: 'text-violet-950',
  },
]
