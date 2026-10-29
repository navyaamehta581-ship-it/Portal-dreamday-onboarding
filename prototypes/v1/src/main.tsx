import React,{Suspense,lazy} from 'react';
import {createRoot} from 'react-dom/client';
import {surfaceOf} from './portal-app/session';

// One entry for every persona: the Portal app routes to Chris's workspace or the customer Portal after sign-in.
// Paths outside the Portal keep the earlier standalone prototype, loaded on its own so styles never mix.
const App=lazy(()=>import('./portal-app/App').then(m=>({default:m.App})));
const LegacyPortal=lazy(()=>import('./styles.css').then(()=>import('./portal/Portal')));
const Surface=surfaceOf(window.location.pathname)?App:LegacyPortal;
createRoot(document.getElementById('root')!).render(<React.StrictMode><Suspense fallback={null}><Surface/></Suspense></React.StrictMode>);
