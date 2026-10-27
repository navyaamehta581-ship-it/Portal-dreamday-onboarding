import React from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';
import Portal from './portal/Portal';
import {ActivationPage} from './activation/ActivationPage';
import {PortalJourney} from './activation/PortalJourney';
createRoot(document.getElementById('root')!).render(<React.StrictMode>{window.location.pathname==='/operator'?<ActivationPage surface="operator" key="operator"/>:window.location.pathname==='/activation'?<ActivationPage surface="developer" key="developer"/>:['/','/portal','/onboarding'].includes(window.location.pathname)?<PortalJourney/>:<Portal/>}</React.StrictMode>);
