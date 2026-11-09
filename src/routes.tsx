import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from './components/AppShell'
import { CalendarPage } from './features/calendar/CalendarPage'
import { DogSummaryPage } from './features/dogs/DogSummaryPage'
import { LoginPage } from './features/auth/LoginPage'
import { OnboardingPage } from './features/auth/OnboardingPage'
import { RequireStaff } from './features/auth/RequireStaff'
import { WelcomePage } from './features/auth/WelcomePage'
import { AddDogPage } from './features/dogs/AddDogPage'
import { DogListPage } from './features/dogs/DogListPage'
import { DogProfilePage } from './features/dogs/DogProfilePage'
import { HouseholdPage } from './features/households/HouseholdPage'
import { NewHouseholdPage } from './features/households/NewHouseholdPage'
import { PlanEditorPage } from './features/plans/PlanEditorPage'
import { EditSessionPage } from './features/sessions/EditSessionPage'
import { LogSessionPage } from './features/sessions/LogSessionPage'
import { BusinessSection } from './features/org/BusinessSection'
import { OrgIndex, OrgLayout } from './features/org/OrgLayout'
import { TagsSection } from './features/org/TagsSection'
import { TeamSection } from './features/org/TeamSection'
import { UpdatesPage } from './features/updates/UpdatesPage'
import { OwnerProfilePage } from './owner/OwnerProfilePage'
import { OwnerUpdatePage } from './owner/OwnerUpdatePage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/onboarding', element: <OnboardingPage /> },
  { path: '/welcome', element: <WelcomePage /> },
  // Public, no-login owner page (Flow C)
  { path: '/u/:token', element: <OwnerUpdatePage /> },
  // Public owner profile: all of a household's dogs (what Send opens)
  { path: '/o/:token', element: <OwnerProfilePage /> },
  {
    element: (
      <RequireStaff>
        <AppShell />
      </RequireStaff>
    ),
    children: [
      { index: true, element: <CalendarPage /> },
      { path: 'dogs', element: <DogListPage /> },
      { path: 'dogs/:dogId', element: <DogProfilePage /> },
      { path: 'dogs/:dogId/summary', element: <DogSummaryPage /> },
      { path: 'dogs/:dogId/plan', element: <PlanEditorPage /> },
      { path: 'dogs/:dogId/log', element: <LogSessionPage /> },
      { path: 'dogs/:dogId/sessions/:sessionId/edit', element: <EditSessionPage /> },
      { path: 'households/new', element: <NewHouseholdPage /> },
      { path: 'households/:householdId', element: <HouseholdPage /> },
      { path: 'households/:householdId/dogs/new', element: <AddDogPage /> },
      { path: 'updates', element: <UpdatesPage /> },
      {
        path: 'org',
        element: (
          <RequireStaff roles={['owner', 'admin']}>
            <OrgLayout />
          </RequireStaff>
        ),
        children: [
          { index: true, element: <OrgIndex /> },
          { path: 'team', element: <TeamSection /> },
          { path: 'locations', element: <Navigate to="../business" replace /> },
          { path: 'tags', element: <TagsSection /> },
          { path: 'business', element: <RequireStaff roles={['owner']}><BusinessSection /></RequireStaff> },
        ],
      },
      { path: 'team', element: <Navigate to="/org/team" replace /> },
    ],
  },
])
