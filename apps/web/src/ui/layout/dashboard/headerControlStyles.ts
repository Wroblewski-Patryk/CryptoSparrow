export const headerControlClass =
  "inline-flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-base-content/80 hover:!bg-transparent focus:!bg-transparent active:!bg-transparent hover:text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40 transition-colors group-open:text-secondary";

export const headerMenuItemClass =
  `${headerControlClass} list-none cursor-pointer [&::-webkit-details-marker]:hidden`;

export const headerMenuItemActiveClass =
  "!text-primary [&>svg]:!text-primary [&>svg]:opacity-100";

export const headerDropdownLinkClass =
  "rounded-md text-base-content/80 transition-colors hover:!bg-transparent focus:!bg-transparent active:!bg-transparent hover:text-secondary";

export const headerDropdownLinkActiveClass =
  "rounded-md !text-primary [&>svg]:!text-primary [&>svg]:opacity-100";

export const getHeaderMenuItemClass = (active: boolean) =>
  active ? `${headerMenuItemClass} ${headerMenuItemActiveClass}` : headerMenuItemClass;

export const getHeaderDropdownLinkClass = (active: boolean) =>
  active ? headerDropdownLinkActiveClass : headerDropdownLinkClass;

export type HeaderDropdownPlacement = 'top' | 'bottom';

export const getHeaderDropdownMenuClass = (
  placement: HeaderDropdownPlacement = 'bottom',
  widthClass = 'w-56'
) =>
  `menu dropdown-content z-[80] ${placement === 'top' ? 'mb-2' : 'mt-2'} ${widthClass} rounded-box border border-base-300/60 bg-base-100 p-2 text-base-content shadow-xl`;
