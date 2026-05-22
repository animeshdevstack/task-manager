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
    body: [
      'Add small wins you want every day — morning routine, health, learning, or work blocks.',
      'In Habit Tracker, use the month grid: only today’s column can be checked off.',
      'Past days stay visible so you can see streaks and patterns at a glance.',
    ],
    primaryLink: { to: '/tasks', label: 'Set daily tasks' },
    secondaryLink: { to: '/habits', label: 'Today’s grid' },
  },
  {
    key: 'weekly',
    title: 'Weekly goals',
    hint: 'Milestones',
    icon: Target,
    gradient: 'from-emerald-400 to-teal-600',
    bg: 'bg-emerald-50/90 ring-emerald-300/50',
    text: 'text-emerald-950',
    body: [
      'Plan what should move forward each week — reviews, deadlines, or family time.',
      'Habit Tracker shows every Sunday in the month; past weeks are read-only.',
      'Check off habits only on the next upcoming Sunday column.',
    ],
    primaryLink: { to: '/tasks', label: 'Set weekly tasks' },
    secondaryLink: { to: '/habits', label: 'Weekly grid' },
  },
  {
    key: 'monthly',
    title: 'Monthly themes',
    hint: 'Big picture',
    icon: CalendarDays,
    gradient: 'from-violet-500 to-fuchsia-600',
    bg: 'bg-violet-50/90 ring-violet-300/50',
    text: 'text-violet-950',
    body: [
      'Capture one big theme for the month — launch, exam prep, fitness, or savings goal.',
      'Tasks live in Task Manager; completion is tracked at month-end in Habit Tracker.',
      'Use Prev / Next month on the tracker to browse earlier or upcoming plans.',
    ],
    primaryLink: { to: '/tasks', label: 'Set monthly tasks' },
    secondaryLink: { to: '/habits', label: 'Month-end review' },
  },
]
