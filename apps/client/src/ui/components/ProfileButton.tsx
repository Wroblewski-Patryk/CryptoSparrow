'use client';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext'; 
import { LuKey, LuLogOut, LuSettings, LuSubscript, LuUser } from 'react-icons/lu';

export default function ProfileButton() {
  const { loading, logout } = useAuth();
  const href = "/dashboard/profile";
  const profileMenu = [
    { label: "Podstawowe", icon: <LuUser className="float-left" />, hash: "basic" },
    { label: "Klucze API", icon: <LuKey className="float-left" />, hash: "api" },
    { label: "Subskrypcja", icon: <LuSubscript className="float-left" />, hash: "subscription" },
    { label: "Bezpieczeństwo", icon: <LuSettings className="float-left" />, hash: "security" },
  ];  

  if (loading) return <span className="mt-2 loading loading-dots loading-xs text-secondary"></span>;
  return (  
    <details>
      <summary><LuUser className="float-left" />Moje konto</summary>
      <ul className="bg-base-100 rounded-t-none"> 
        {profileMenu.map(item => (
        <li key={item.hash}>
            <a
            href={`${href}#${item.hash}`}
            className=""
            onClick={e => {
              e.preventDefault();
              if (window.location.href !== href)
                window.location.replace(`${href}#${item.hash}`);   
              window.location.hash = item.hash;
            }}
          >{item.icon}{item.label}</a>
        </li>
        ))}
        <li>
          <button 
            onClick={logout} 
            className="cursor-pointer"
            ><LuLogOut className='float-left'/> Wyloguj
          </button>
        </li>
      </ul>
    </details>
  );
}