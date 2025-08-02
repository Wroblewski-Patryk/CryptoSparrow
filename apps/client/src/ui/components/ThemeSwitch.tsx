import { HiOutlineColorSwatch } from "react-icons/hi";

export default function ThemeSwitcher(){
    return(
        <details>
            <summary><HiOutlineColorSwatch className="float-left" />Motyw</summary>
            <ul className="bg-base-100 rounded-t-none p-2"> 
                <li>
                    <input
                        type="radio"
                        name="theme-dropdown"
                        className="theme-controller w-full btn btn-sm btn-block btn-ghost justify-start"
                        aria-label="Domyślny"
                        value="default" />
                </li>
                <li>
                    <input
                        type="radio"
                        name="theme-dropdown"
                        className="theme-controller w-full btn btn-sm btn-block btn-ghost justify-start"
                        aria-label="Cyberpunk"
                        value="cyberpunk" />
                </li>
                <li>
                    <input
                        type="radio"
                        name="theme-dropdown"
                        className="theme-controller w-full btn btn-sm btn-block btn-ghost justify-start"
                        aria-label="Luksus"
                        value="luxury" />
                </li>
            </ul>
        </details>
    );
}