import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowRightLeft,Bell,BookOpen,Bookmark,ChartColumn,CheckCheck,ChevronRight,Container,Flag,Folder,Globe,GraduationCap,History,House,LayoutGrid,ListChecks,Lock,Newspaper,Plus,Puzzle,Radar,ScrollText,Search,Settings,Triangle,type LucideIcon} from 'lucide-react';
import {Logo} from './Logo';
import {Link} from './router';
import {DemoMenu} from './DemoRoom';

export type NavItem={slug:string;label:string;icon:LucideIcon;to?:string;tag?:string;dot?:boolean;chevron?:boolean;solid?:boolean};
/** Navigation as shown in references 053–061. Only Home and Onboarding are functional in this demo. */
export const PRIMARY_NAV:NavItem[]=[
 {solid:true,slug:'home',label:'Home',icon:House,to:'/portal'},
 {slug:'onboarding',label:'Onboarding',icon:Flag,to:'/activation'},
 {solid:true,slug:'catalog',label:'Catalog',icon:Folder},
 {slug:'docs',label:'Docs',icon:Newspaper},
 {slug:'data-experience',label:'Data Experience',icon:Globe},
 {slug:'fleetshift',label:'Fleetshift',icon:Container,tag:'Beta'},
 {solid:true,slug:'notifications',label:'Notifications',icon:Bell,dot:true},
 {slug:'insights',label:'Insights',icon:ChartColumn},
 {solid:true,slug:'rbac',label:'Role Based Access Control',icon:Lock},
 {solid:true,slug:'skill-exchange',label:'Skill Exchange',icon:GraduationCap},
 {slug:'soundcheck',label:'Soundcheck',icon:CheckCheck},
 {slug:'aika',label:'AiKA',icon:Triangle},
 {slug:'confidence',label:'Confidence',icon:LayoutGrid},
 {slug:'tech-radar',label:'Tech Radar',icon:Radar},
 {solid:true,slug:'docs-hub',label:'Docs Hub',icon:BookOpen},
 {slug:'migration-agent',label:'Migration Agent',icon:ArrowRightLeft},
 {slug:'create',label:'Create',icon:Plus},
 {slug:'bookmarks',label:'Add to Bookmarks',icon:Bookmark,chevron:true},
];
export const SECONDARY_NAV:NavItem[]=[
 {slug:'app-settings',label:'App Settings',icon:Settings},
 {slug:'plugins',label:'Plugins',icon:Puzzle},
 {slug:'catalog-settings',label:'Catalog Settings',icon:ListChecks},
 {slug:'config-history',label:'Config History',icon:History},
 {slug:'log-viewer',label:'Log Viewer',icon:ScrollText},
];
export const ALL_NAV=[...PRIMARY_NAV,...SECONDARY_NAV];
export const navHref=(item:NavItem)=>item.to??`/portal/x/${item.slug}`;

type Href=(item:NavItem)=>string;
function Nav({items,active,href,className='pt-nav'}:{items:NavItem[];active:string;href:Href;className?:string}){
 return <ul className={className}>{items.map(item=>{const Icon=item.icon;return <li key={item.slug}>
  <Link to={href(item)} aria-current={active===item.slug?'page':undefined}>
   <Icon size={16} strokeWidth={2.4} fill={item.solid?'currentColor':'none'} aria-hidden="true"/>{item.dot&&<span className="dot" aria-hidden="true"/>}{item.label}
   {item.tag&&<span className="tag">{item.tag}</span>}{item.chevron&&<ChevronRight className="chev" size={16} aria-hidden="true"/>}
  </Link></li>;})}</ul>;
}

/** Who is signed in to this surface and the one action their menu offers. */
export type ShellUser={name:string;detail:string;actionLabel:string;onAction:()=>void};

function AccountMenu({user}:{user:ShellUser}){
 const [open,setOpen]=useState(false),ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const close=(e:MouseEvent|KeyboardEvent)=>{if(e instanceof KeyboardEvent?e.key==='Escape':!ref.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('mousedown',close);document.addEventListener('keydown',close);return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',close);};},[open]);
 return <div className="pt-avatar" ref={ref}>
  <button aria-haspopup="menu" aria-expanded={open} aria-label={`Account: ${user.name}`} onClick={()=>setOpen(!open)}>{user.name.trim().charAt(0).toUpperCase()}</button>
  {open&&<div className="pt-menu" role="menu"><p><strong>{user.name}</strong>{user.detail}</p><button role="menuitem" onClick={()=>{setOpen(false);user.onAction();}}>{user.actionLabel}</button></div>}
 </div>;
}

/** The one Portal shell (053–061), shared by the developer Portal and Chris's workspace.
 * Each surface passes its own navigation targets; authorization stays with the surface. */
export function Shell({active,user,homeHref='/portal',primaryNav=PRIMARY_NAV,href=navHref,children}:{active:string;user:ShellUser;homeHref?:string;primaryNav?:NavItem[];href?:Href;children:ReactNode}){
 return <div className="pt-shell">
  <header className="pt-top">
   <Link to={homeHref} aria-label="Spotify Portal home"><Logo/></Link>
   <div className="pt-search" aria-disabled="true" title="Search is not available in this demo"><Search size={17} strokeWidth={2.6} aria-hidden="true"/>Search in Portal</div>
   <div className="pt-top-end"><DemoMenu/><AccountMenu user={user}/></div>
  </header>
  <div className="pt-body">
   <nav className="pt-side" aria-label="Portal">
    <Nav items={primaryNav} active={active} href={href}/>
    <Nav items={SECONDARY_NAV} active={active} href={href} className="pt-nav secondary"/>
   </nav>
   <main className="pt-main" id="main">{children}</main>
  </div>
 </div>;
}
