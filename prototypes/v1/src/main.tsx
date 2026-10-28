import React,{Suspense,lazy} from 'react';
import {createRoot} from 'react-dom/client';

// Two separate surfaces on one backend: /operator for Chris, Portal routes for developers.
// Each surface is loaded on its own so its styles never leak into another.
const PortalApp=lazy(()=>import('./portal-app/PortalApp').then(m=>({default:m.PortalApp})));
const OperatorWorkspace=lazy(()=>import('./operator/OperatorWorkspace').then(m=>({default:m.OperatorWorkspace})));
const LegacyPortal=lazy(()=>import('./styles.css').then(()=>import('./portal/Portal')));
const path=window.location.pathname;
const portal=path==='/'||path==='/login'||path==='/onboarding'||path==='/portal'||path.startsWith('/portal/')||path==='/activation'||path.startsWith('/activation/');
const Surface=path==='/operator'||path.startsWith('/operator/')?OperatorWorkspace:portal?PortalApp:LegacyPortal;
createRoot(document.getElementById('root')!).render(<React.StrictMode><Suspense fallback={null}><Surface/></Suspense></React.StrictMode>);
