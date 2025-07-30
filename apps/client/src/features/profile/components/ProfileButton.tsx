'use client';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext'; 
import { LuKey, LuLogOut, LuSettings, LuSubscript, LuUser } from 'react-icons/lu';

export default function ProfileButton() {
  const { loading, logout } = useAuth();
  const href = "/dashboard/profile";
  const profileMenu = [
    { label: "Podstawowe", icon: <LuUser className="float-left mt-1 mr-2" />, hash: "basic" },
    { label: "Klucze API", icon: <LuKey className="float-left mt-1 mr-2" />, hash: "api" },
    { label: "Subskrypcja", icon: <LuSubscript className="float-left mt-1 mr-2" />, hash: "subscription" },
    { label: "Bezpieczeństwo", icon: <LuSettings className="float-left mt-1 mr-2" />, hash: "security" },
  ];  

  if (loading) return <div className="loading loading-spinner text-primary"></div>;
  return ( 
    <div className="relative group w-45">
      <Link 
        href="/dashboard/profile" 
        className="flex px-4 py-2 rounded hover:bg-gray-800 transition"
        ><LuUser className="float-left mt-1 mr-2" /> Moje konto
      </Link>
      <div className="hidden group-hover:flex flex-col absolute right-0 w-45 bg-gray-800 rounded shadow-lg z-50">
        {profileMenu.map(item => (
        <a
          key={item.hash}
          href={`${href}#${item.hash}`}
          className="px-4 py-2 flex items-center rounded hover:bg-gray-700"
          onClick={e => {
            e.preventDefault();
            if (window.location.href !== href)
              window.location.replace(`${href}#${item.hash}`);
            
            window.location.hash = item.hash;
          }}
        >{item.icon}{item.label}</a>
        ))}
        <button 
          onClick={logout} 
          className="px-4 py-2 flex items-center rounded hover:bg-gray-700 cursor-pointer"
          ><LuLogOut className='float-left mt-1 mr-2'/> Wyloguj
        </button>
      </div>
    </div>
  );
}