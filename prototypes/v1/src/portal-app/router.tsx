import {useEffect,useState,type ReactNode,type AnchorHTMLAttributes} from 'react';
/** Minimal history routing for the Portal surface. */
export function navigate(to:string,replace=false){
 if(to===window.location.pathname)return;
 window.history[replace?'replaceState':'pushState'](null,'',to);
 window.dispatchEvent(new PopStateEvent('popstate'));
}
export function usePath(){
 const [path,setPath]=useState(window.location.pathname);
 useEffect(()=>{const sync=()=>setPath(window.location.pathname);window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
 return path;
}
export function Link({to,children,...rest}:{to:string;children:ReactNode}&Omit<AnchorHTMLAttributes<HTMLAnchorElement>,'href'>){
 return <a href={to} {...rest} onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.button!==0)return;e.preventDefault();navigate(to);}}>{children}</a>;
}
