export const headerControlClass =
  "inline-flex min-h-9 items-center gap-2 rounded-md border border-transparent px-3 py-2 text-base-content/80 hover:border-primary/35 hover:bg-primary/10 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40 transition-colors group-open:border-primary/35 group-open:bg-primary/10 group-open:text-primary";

export const headerMenuItemClass =
  `${headerControlClass} list-none cursor-pointer [&::-webkit-details-marker]:hidden`;

export const headerMenuItemActiveClass =
  "!border !border-accent/45 bg-transparent !text-accent [&>svg]:!text-accent [&>svg]:opacity-100";

export const headerDropdownLinkClass =
  "rounded-md border border-transparent transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary";

export const headerDropdownLinkActiveClass =
  "rounded-md !border !border-accent/45 bg-transparent !text-accent [&>svg]:!text-accent [&>svg]:opacity-100";

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
